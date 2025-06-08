from django.shortcuts import render
from rest_framework.decorators import api_view, parser_classes
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser
from django.conf import settings
import os
import joblib
import json
import pandas as pd
from .model_trainer import train_accident_model_from_db, AccidentPredictorAPI
from .models import Siniestro
from django.http import HttpResponse
import io
from django.db import transaction
from datetime import datetime, date
import traceback

@api_view(['POST'])
def train_model(request):
    """
    Entrena el modelo y guarda los resultados en la carpeta ml_model.
    """
    try:
        # Directorio donde guardar el modelo y métricas
        output_dir = os.path.join(settings.BASE_DIR, 'projects', 'ml_model')
        
        # Crear directorio si no existe
        os.makedirs(output_dir, exist_ok=True)
        
        # Parámetros opcionales del request
        target_col = request.data.get('target_col', 'ACCIDENTE')
        model_filename = request.data.get('model_filename', 'modelo_accidentes.pkl')
        metrics_filename = request.data.get('metrics_filename', 'metricas_modelo.json')
        
        # Entrenar el modelo usando el modelo Siniestro
        result = train_accident_model_from_db(
            model_class=Siniestro,
            output_dir=output_dir,
            target_col=target_col,
            model_filename=model_filename,
            metrics_filename=metrics_filename
        )
        
        if result['success']:
            return Response({
                'success': True,
                'message': 'Modelo entrenado exitosamente',
                'model_path': result.get('model_path'),
                'metrics_path': result.get('metrics_path'),
                'metrics': result['metrics'],
                'training_info': {
                    'total_records': result['metrics'].get('total_samples', 'N/A'),
                    'features_used': Siniestro.TRAINING_FIELDS,
                    'target_variable': target_col,
                    'excluded_columns': ['FECHA_SINIESTRO', 'FECHA_INGRESO', 'id']
                }
            }, status=status.HTTP_200_OK)
        else:
            return Response({
                'success': False,
                'message': result['message'],
                'error': result['error']
            }, status=status.HTTP_400_BAD_REQUEST)
            
    except Exception as e:
        return Response({
            'success': False,
            'message': 'Error interno del servidor',
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
def predict(request):
    """
    Realiza predicciones usando el modelo entrenado.
    Espera un array de datos con los campos necesarios para predicción.
    """
    try:
        # Ruta del modelo guardado
        model_path = os.path.join(settings.BASE_DIR, 'projects', 'ml_model', 'modelo_accidentes.pkl')
        
        if not os.path.exists(model_path):
            return Response({
                'success': False,
                'message': 'Modelo no encontrado. Primero entrene el modelo usando /api/train-model/'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Obtener datos del request
        data = request.data.get('data')
        threshold = request.data.get('threshold', 0.5)
        
        if not data:
            return Response({
                'success': False,
                'message': 'No se proporcionaron datos para predecir',
                'required_fields': Siniestro.TRAINING_FIELDS
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Validar que los datos tengan los campos requeridos
        if isinstance(data, dict):
            data = [data]  # Convertir a lista si es un solo objeto
        
        # Verificar campos requeridos
        missing_fields = []
        for record in data:
            missing = [field for field in Siniestro.TRAINING_FIELDS if field not in record]
            if missing:
                missing_fields.extend(missing)
        
        if missing_fields:
            return Response({
                'success': False,
                'message': 'Faltan campos requeridos en los datos',
                'missing_fields': list(set(missing_fields)),
                'required_fields': Siniestro.TRAINING_FIELDS
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Cargar el modelo
        model = joblib.load(model_path)
        
        # Convertir datos a DataFrame con solo los campos de entrenamiento
        df_data = []
        for record in data:
            filtered_record = {field: record[field] for field in Siniestro.TRAINING_FIELDS}
            df_data.append(filtered_record)
        
        df = pd.DataFrame(df_data)
        
        # Realizar predicciones
        probabilities = model.predict_proba(df)[:, 1]
        predictions = (probabilities >= threshold).astype(int)
        
        # Preparar respuesta
        results = []
        for i, (pred, prob) in enumerate(zip(predictions, probabilities)):
            results.append({
                'index': i,
                'input_data': df_data[i],
                'prediction': int(pred),
                'probability': float(prob),
                'risk_level': 'Alto' if prob > 0.7 else 'Medio' if prob > 0.3 else 'Bajo',
                'accident_likely': bool(pred)
            })
        
        return Response({
            'success': True,
            'predictions': results,
            'summary': {
                'total_predictions': len(results),
                'accidents_predicted': sum(1 for r in results if r['accident_likely']),
                'high_risk': sum(1 for r in results if r['risk_level'] == 'Alto'),
                'medium_risk': sum(1 for r in results if r['risk_level'] == 'Medio'),
                'low_risk': sum(1 for r in results if r['risk_level'] == 'Bajo')
            },
            'threshold_used': threshold
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'success': False,
            'message': 'Error al realizar predicciones',
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def model_info(request):
    """
    Obtiene la información y métricas del modelo entrenado.
    """
    try:
        # Ruta del archivo de métricas
        metrics_path = os.path.join(settings.BASE_DIR, 'projects', 'ml_model', 'metricas_modelo.json')
        model_path = os.path.join(settings.BASE_DIR, 'projects', 'ml_model', 'modelo_accidentes.pkl')
        
        if not os.path.exists(metrics_path):
            return Response({
                'success': False,
                'message': 'Métricas del modelo no encontradas. Primero entrene el modelo usando /api/train-model/',
                'model_info': {
                    'required_fields_for_training': Siniestro.TRAINING_FIELDS + [Siniestro.TARGET_FIELD],
                    'required_fields_for_prediction': Siniestro.TRAINING_FIELDS,
                    'target_field': Siniestro.TARGET_FIELD,
                    'excluded_fields': ['FECHA_SINIESTRO', 'FECHA_INGRESO', 'id']
                }
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Leer métricas del archivo JSON
        with open(metrics_path, 'r', encoding='utf-8') as f:
            metrics = json.load(f)
        
        # Información adicional del modelo
        model_exists = os.path.exists(model_path)
        model_size = os.path.getsize(model_path) if model_exists else 0
        
        return Response({
            'success': True,
            'model_info': {
                'model_exists': model_exists,
                'model_size_bytes': model_size,
                'model_size_mb': round(model_size / (1024 * 1024), 2),
                'metrics_file': metrics_path,
                'model_file': model_path if model_exists else None,
                'training_fields': Siniestro.TRAINING_FIELDS,
                'target_field': Siniestro.TARGET_FIELD,
                'excluded_fields': ['FECHA_SINIESTRO', 'FECHA_INGRESO', 'id']
            },
            'metrics': metrics
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'success': False,
            'message': 'Error al obtener información del modelo',
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
@api_view(['POST'])
def batch_predict(request):
    """
    Realiza predicciones por lotes subiendo un archivo CSV.
    Puede devolver JSON o CSV según el parámetro 'output_format'.
    """
    try:
        # Debug: Imprimir información del request
        print("=== DEBUG BATCH PREDICT ===")
        print(f"Request method: {request.method}")
        print(f"Request FILES: {request.FILES}")
        
        # Verificar que el modelo existe
        model_path = os.path.join(settings.BASE_DIR, 'projects', 'ml_model', 'modelo_accidentes.pkl')
        
        if not os.path.exists(model_path):
            return Response({
                'success': False,
                'message': 'Modelo no encontrado. Primero entrene el modelo usando /api/train-model/'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Verificar que se subió un archivo
        file_obj = None
        if 'file' in request.FILES:
            file_obj = request.FILES['file']
        elif len(request.FILES) > 0:
            file_obj = list(request.FILES.values())[0]
        
        if not file_obj:
            return Response({
                'success': False,
                'message': 'No se proporcionó ningún archivo CSV'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Obtener parámetros
        threshold = float(request.data.get('threshold', 0.5))
        output_format = request.data.get('output_format', 'json').lower()  # 'json' o 'csv'
        
        print(f"Archivo detectado: {file_obj.name}")
        print(f"Threshold: {threshold}")
        print(f"Output format: {output_format}")
        
        # Validar extensión del archivo
        if not file_obj.name.lower().endswith('.csv'):
            return Response({
                'success': False,
                'message': f'El archivo debe ser un CSV (.csv). Archivo recibido: {file_obj.name}'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Leer el archivo CSV
        try:
            file_obj.seek(0)
            csv_data = file_obj.read().decode('utf-8')
            df = pd.read_csv(io.StringIO(csv_data))
            
            if df.empty:
                return Response({
                    'success': False,
                    'message': 'El archivo CSV está vacío'
                }, status=status.HTTP_400_BAD_REQUEST)
            
        except Exception as e:
            return Response({
                'success': False,
                'message': f'Error al leer el archivo CSV: {str(e)}'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Limpiar nombres de columnas
        df.columns = df.columns.str.strip()
        
        # Verificar que todas las columnas requeridas estén presentes
        missing_fields = [field for field in Siniestro.TRAINING_FIELDS if field not in df.columns]
        if missing_fields:
            return Response({
                'success': False,
                'message': 'Faltan columnas requeridas en el archivo CSV',
                'missing_fields': missing_fields,
                'required_fields': Siniestro.TRAINING_FIELDS,
                'found_columns': list(df.columns)
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Verificar valores nulos
        null_counts = df[Siniestro.TRAINING_FIELDS].isnull().sum()
        if null_counts.sum() > 0:
            null_fields = null_counts[null_counts > 0].to_dict()
            return Response({
                'success': False,
                'message': 'Se encontraron valores nulos en campos requeridos',
                'null_fields': null_fields
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Cargar el modelo
        model = joblib.load(model_path)
        
        # Seleccionar columnas para predicción
        df_filtered = df[Siniestro.TRAINING_FIELDS]
        
        # Realizar predicciones
        probabilities = model.predict_proba(df_filtered)[:, 1]
        predictions = (probabilities >= threshold).astype(int)
        
        # Crear DataFrame con resultados
        # Copiar datos originales
        df_results = df.copy()
        
        # Agregar columnas de predicción
        df_results['PREDICTION'] = predictions
        df_results['PROBABILITY'] = probabilities
        df_results['RISK_LEVEL'] = ['Alto' if p > 0.7 else 'Medio' if p > 0.3 else 'Bajo' for p in probabilities]
        df_results['ACCIDENT_LIKELY'] = predictions.astype(bool)
        
        # Si se solicita CSV, devolver archivo
        if output_format == 'csv':
            response = HttpResponse(content_type='text/csv; charset=utf-8')
            
            # Nombre del archivo con timestamp
            timestamp = pd.Timestamp.now().strftime('%Y%m%d_%H%M%S')
            filename = f"predicciones_batch_{timestamp}.csv"
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            
            # Escribir CSV
            df_results.to_csv(response, index=False, encoding='utf-8')
            
            return response
        
        # Si se solicita JSON (por defecto), devolver respuesta JSON
        else:
            # Preparar resultados para JSON
            results = []
            for i, row in df_results.iterrows():
                # Datos de entrada (solo campos de entrenamiento)
                input_data = {field: row[field] for field in Siniestro.TRAINING_FIELDS}
                
                results.append({
                    'row_index': i,
                    'input_data': input_data,
                    'prediction': int(row['PREDICTION']),
                    'probability': float(row['PROBABILITY']),
                    'risk_level': row['RISK_LEVEL'],
                    'accident_likely': bool(row['ACCIDENT_LIKELY'])
                })
            
            # Estadísticas del lote
            import numpy as np
            summary = {
                'total_predictions': len(results),
                'accidents_predicted': sum(1 for r in results if r['accident_likely']),
                'no_accidents_predicted': sum(1 for r in results if not r['accident_likely']),
                'high_risk': sum(1 for r in results if r['risk_level'] == 'Alto'),
                'medium_risk': sum(1 for r in results if r['risk_level'] == 'Medio'),
                'low_risk': sum(1 for r in results if r['risk_level'] == 'Bajo'),
                'average_probability': float(np.mean(probabilities)),
                'max_probability': float(np.max(probabilities)),
                'min_probability': float(np.min(probabilities))
            }
            
            return Response({
                'success': True,
                'message': f'Predicciones realizadas para {len(results)} registros',
                'predictions': results,
                'summary': summary,
                'threshold_used': threshold,
                'file_info': {
                    'filename': file_obj.name,
                    'rows_processed': len(df),
                    'columns_found': list(df.columns)
                },
                'note': 'Para obtener CSV, use output_format=csv'
            }, status=status.HTTP_200_OK)
        
    except Exception as e:
        import traceback
        return Response({
            'success': False,
            'message': 'Error al procesar las predicciones por lotes',
            'error': str(e),
            'traceback': traceback.format_exc()
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
def download_csv(request):
    """
    Permite descargar todos los datos de la base en formato CSV.
    """
    try:
        # Parámetros opcionales
        limit = request.GET.get('limit', None)
        include_predictions = request.GET.get('include_predictions', 'false').lower() == 'true'
        
        # Obtener todos los datos de la base
        queryset = Siniestro.objects.all()
        
        # Aplicar límite si se especifica
        if limit:
            try:
                limit = int(limit)
                queryset = queryset[:limit]
            except ValueError:
                return Response({
                    'success': False,
                    'message': 'El parámetro limit debe ser un número entero'
                }, status=status.HTTP_400_BAD_REQUEST)
        
        # Verificar que hay datos
        if not queryset.exists():
            return Response({
                'success': False,
                'message': 'No se encontraron datos en la base de datos'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Convertir a DataFrame
        from django.forms.models import model_to_dict
        data_list = [model_to_dict(obj) for obj in queryset]
        df = pd.DataFrame(data_list)
        
        # Si se solicitan predicciones, agregarlas
        if include_predictions:
            model_path = os.path.join(settings.BASE_DIR, 'projects', 'ml_model', 'modelo_accidentes.pkl')
            
            if os.path.exists(model_path):
                try:
                    # Cargar modelo
                    model = joblib.load(model_path)
                    
                    # Preparar datos para predicción (solo campos de entrenamiento)
                    df_pred = df[Siniestro.TRAINING_FIELDS]
                    
                    # Realizar predicciones
                    probabilities = model.predict_proba(df_pred)[:, 1]
                    predictions = (probabilities >= 0.5).astype(int)
                    
                    # Agregar columnas de predicción
                    df['PREDICCION_ACCIDENTE'] = predictions
                    df['PROBABILIDAD_ACCIDENTE'] = probabilities
                    df['NIVEL_RIESGO'] = ['Alto' if p > 0.7 else 'Medio' if p > 0.3 else 'Bajo' for p in probabilities]
                    
                except Exception as e:
                    # Si hay error en las predicciones, continuar sin ellas
                    print(f"Error al generar predicciones: {e}")
        
        # Crear respuesta HTTP con el CSV
        response = HttpResponse(content_type='text/csv; charset=utf-8')
        
        # Nombre del archivo
        filename = f"siniestros_data_{pd.Timestamp.now().strftime('%Y%m%d_%H%M%S')}.csv"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        
        # Escribir CSV
        df.to_csv(response, index=False, encoding='utf-8')
        
        return response
        
    except Exception as e:
        return Response({
            'success': False,
            'message': 'Error al generar el archivo CSV',
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def download_template_csv(request):
    """
    Descarga un archivo CSV de plantilla con las columnas requeridas para predicciones.
    """
    try:
        # Datos de ejemplo más realistas
        example_data = [
            {
                'HORA_SINIESTRO': 14,
                'CLASE_SINIESTRO': 1,
                'CANTIDAD_DE_VEHICULOS_DANADOS': 2,  # Corregido: sin tilde
                'DISTRITO': 15,
                'ZONA': 1,
                'TIPO_DE_VIA': 2,
                'RED_VIAL': 1,
                'EXISTE_CICLOVIA': 0,
                'CONDICION_CLIMATICA': 1,
                'ZONIFICACION': 2,
                'CARACTERISTICAS_DE_VIA': 1,
                'PERFIL_LONGITUDINAL_VIA': 1,
                'SUPERFICIE_DE_CALZADA': 1,
                'SENALIZACION': 1,
                'DIA_DE_LA_SEMANA': 3,
                'MES': 6,
                'PERIODO_DEL_DIA': 2,
                'FERIADO': 0
            },
            {
                'HORA_SINIESTRO': 8,
                'CLASE_SINIESTRO': 2,
                'CANTIDAD_DE_VEHICULOS_DANADOS': 1,  # Corregido: sin tilde
                'DISTRITO': 10,
                'ZONA': 2,
                'TIPO_DE_VIA': 1,
                'RED_VIAL': 2,
                'EXISTE_CICLOVIA': 1,
                'CONDICION_CLIMATICA': 2,
                'ZONIFICACION': 1,
                'CARACTERISTICAS_DE_VIA': 2,
                'PERFIL_LONGITUDINAL_VIA': 2,
                'SUPERFICIE_DE_CALZADA': 2,
                'SENALIZACION': 2,
                'DIA_DE_LA_SEMANA': 1,
                'MES': 12,
                'PERIODO_DEL_DIA': 1,
                'FERIADO': 1
            }
        ]
        
        df = pd.DataFrame(example_data)
        
        # Crear respuesta HTTP
        response = HttpResponse(content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = 'attachment; filename="plantilla_predicciones.csv"'
        
        # Escribir CSV
        df.to_csv(response, index=False, encoding='utf-8')
        
        return response
        
    except Exception as e:
        return Response({
            'success': False,
            'message': 'Error al generar la plantilla CSV',
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    

#@csrf_exempt
@api_view(['POST'])
@parser_classes([MultiPartParser, FormParser])
def upload_and_retrain(request):
    """
    Sube datos desde un archivo CSV a la base de datos y reentresa el modelo automáticamente.
    
    Campos requeridos en el CSV:
    HORA_SINIESTRO, CLASE_SINIESTRO, CANTIDAD_DE_VEHICULOS_DANADOS, DISTRITO, ZONA,
    TIPO_DE_VIA, RED_VIAL, EXISTE_CICLOVIA, CONDICION_CLIMATICA, ZONIFICACION,
    CARACTERISTICAS_DE_VIA, PERFIL_LONGITUDINAL_VIA, SUPERFICIE_DE_CALZADA,
    SENALIZACION, DIA_DE_LA_SEMANA, MES, PERIODO_DEL_DIA, FERIADO, ACCIDENTE, FECHA_SINIESTRO
    
    Nota: FECHA_SINIESTRO puede estar vacía, en cuyo caso se usará la fecha actual.
    """
    try:
        print("=== DEBUG UPLOAD AND RETRAIN ===")
        print(f"Request FILES: {list(request.FILES.keys())}")
        print(f"Request data: {list(request.data.keys())}")
        
        # Verificar que se subió un archivo
        file_obj = None
        if 'file' in request.FILES:
            file_obj = request.FILES['file']
        elif len(request.FILES) > 0:
            file_obj = list(request.FILES.values())[0]
        
        if not file_obj:
            return Response({
                'success': False,
                'message': 'No se proporcionó ningún archivo CSV',
                'required_fields': Siniestro.TRAINING_FIELDS + [Siniestro.TARGET_FIELD, 'FECHA_SINIESTRO'],
                'instructions': 'Suba un archivo CSV con todos los campos requeridos para entrenamiento'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Parámetros opcionales
        auto_retrain = request.data.get('auto_retrain', 'true').lower() == 'true'
        validate_data = request.data.get('validate_data', 'true').lower() == 'true'
        default_date_for_nulls = request.data.get('default_date', date.today().strftime('%Y-%m-%d'))
        
        print(f"Archivo: {file_obj.name}")
        print(f"Auto retrain: {auto_retrain}")
        print(f"Validate data: {validate_data}")
        print(f"Default date for nulls: {default_date_for_nulls}")
        
        # Validar extensión del archivo
        if not file_obj.name.lower().endswith('.csv'):
            return Response({
                'success': False,
                'message': f'El archivo debe ser un CSV (.csv). Archivo recibido: {file_obj.name}'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Leer el archivo CSV
        try:
            file_obj.seek(0)
            csv_data = file_obj.read().decode('utf-8')
            df = pd.read_csv(io.StringIO(csv_data))
            
            if df.empty:
                return Response({
                    'success': False,
                    'message': 'El archivo CSV está vacío'
                }, status=status.HTTP_400_BAD_REQUEST)
            
        except UnicodeDecodeError:
            try:
                file_obj.seek(0)
                csv_data = file_obj.read().decode('latin-1')
                df = pd.read_csv(io.StringIO(csv_data))
            except Exception as e:
                return Response({
                    'success': False,
                    'message': f'Error de codificación al leer el archivo CSV: {str(e)}'
                }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({
                'success': False,
                'message': f'Error al leer el archivo CSV: {str(e)}'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Limpiar nombres de columnas
        df.columns = df.columns.str.strip()
        
        print(f"Columnas encontradas: {list(df.columns)}")
        print(f"Forma del DataFrame: {df.shape}")
        
        # Campos requeridos para la inserción
        required_fields = Siniestro.TRAINING_FIELDS + [Siniestro.TARGET_FIELD, 'FECHA_SINIESTRO']
        
        # Verificar que todas las columnas requeridas estén presentes
        missing_fields = [field for field in required_fields if field not in df.columns]
        if missing_fields:
            return Response({
                'success': False,
                'message': 'Faltan columnas requeridas en el archivo CSV',
                'missing_fields': missing_fields,
                'required_fields': required_fields,
                'found_columns': list(df.columns)
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Validar datos si se solicita
        if validate_data:
            # Verificar valores nulos en campos críticos (EXCLUYENDO FECHA_SINIESTRO)
            critical_fields = Siniestro.TRAINING_FIELDS + [Siniestro.TARGET_FIELD]
            null_counts = df[critical_fields].isnull().sum()
            if null_counts.sum() > 0:
                null_fields = null_counts[null_counts > 0].to_dict()
                return Response({
                    'success': False,
                    'message': 'Se encontraron valores nulos en campos críticos',
                    'null_fields': null_fields,
                    'note': 'FECHA_SINIESTRO puede estar vacía y se manejará automáticamente'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Validar tipos de datos numéricos
            numeric_fields = Siniestro.TRAINING_FIELDS + [Siniestro.TARGET_FIELD]
            for field in numeric_fields:
                if not pd.api.types.is_numeric_dtype(df[field]):
                    try:
                        df[field] = pd.to_numeric(df[field], errors='coerce')
                        if df[field].isnull().any():
                            return Response({
                                'success': False,
                                'message': f'El campo {field} contiene valores no numéricos'
                            }, status=status.HTTP_400_BAD_REQUEST)
                    except:
                        return Response({
                            'success': False,
                            'message': f'No se pudo convertir el campo {field} a numérico'
                        }, status=status.HTTP_400_BAD_REQUEST)
        
        # MANEJO ESPECIAL PARA FECHAS VACÍAS
        print("Procesando fechas...")
        
        # Contar fechas vacías antes del procesamiento
        null_dates_count = 0
        if 'FECHA_SINIESTRO' in df.columns:
            null_dates_count = df['FECHA_SINIESTRO'].isnull().sum()
            empty_dates_count = len(df[df['FECHA_SINIESTRO'].astype(str).str.strip().isin(['', 'NaN', 'nan', 'null', 'NULL'])])
            print(f"Fechas nulas detectadas: {null_dates_count}")
            print(f"Fechas vacías detectadas: {empty_dates_count}")
        
        # Limpiar y convertir fechas
        try:
            # Reemplazar valores vacíos, NaN, etc. con None
            df['FECHA_SINIESTRO'] = df['FECHA_SINIESTRO'].replace(['', 'NaN', 'nan', 'null', 'NULL'], None)
            
            # Convertir a datetime, manteniendo NaT para valores nulos
            df['FECHA_SINIESTRO'] = pd.to_datetime(df['FECHA_SINIESTRO'], errors='coerce')
            
            print(f"Fechas después de conversión inicial:")
            print(f"- Fechas válidas: {df['FECHA_SINIESTRO'].notna().sum()}")
            print(f"- Fechas NaT: {df['FECHA_SINIESTRO'].isna().sum()}")
            
        except Exception as e:
            return Response({
                'success': False,
                'message': f'Error al procesar fechas: {str(e)}'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Agregar FECHA_INGRESO (fecha actual)
        df['FECHA_INGRESO'] = date.today()
        
        # Comenzar transacción para insertar datos
        records_created = 0
        records_errors = 0
        dates_fixed = 0
        error_details = []
        
        try:
            with transaction.atomic():
                print(f"Iniciando inserción de {len(df)} registros...")
                
                for index, row in df.iterrows():
                    try:
                        # MANEJO ESPECIAL DE FECHA_SINIESTRO
                        fecha_siniestro = row['FECHA_SINIESTRO']
                        
                        # Si la fecha es NaT (Not a Time) o nula, usar fecha por defecto
                        if pd.isna(fecha_siniestro):
                            # Usar fecha por defecto (puede ser fecha actual o una fecha específica)
                            try:
                                fecha_siniestro = datetime.strptime(default_date_for_nulls, '%Y-%m-%d').date()
                            except:
                                fecha_siniestro = date.today()
                            dates_fixed += 1
                        else:
                            # Convertir datetime a date si es necesario
                            if hasattr(fecha_siniestro, 'date'):
                                fecha_siniestro = fecha_siniestro.date()
                            elif isinstance(fecha_siniestro, str):
                                try:
                                    fecha_siniestro = datetime.strptime(fecha_siniestro, '%Y-%m-%d').date()
                                except:
                                    fecha_siniestro = date.today()
                                    dates_fixed += 1
                        
                        # Crear objeto Siniestro
                        siniestro_data = {
                            'HORA_SINIESTRO': int(row['HORA_SINIESTRO']),
                            'CLASE_SINIESTRO': int(row['CLASE_SINIESTRO']),
                            'CANTIDAD_DE_VEHICULOS_DANADOS': int(row['CANTIDAD_DE_VEHICULOS_DANADOS']),
                            'DISTRITO': int(row['DISTRITO']),
                            'ZONA': int(row['ZONA']),
                            'TIPO_DE_VIA': int(row['TIPO_DE_VIA']),
                            'RED_VIAL': int(row['RED_VIAL']),
                            'EXISTE_CICLOVIA': int(row['EXISTE_CICLOVIA']),
                            'CONDICION_CLIMATICA': int(row['CONDICION_CLIMATICA']),
                            'ZONIFICACION': int(row['ZONIFICACION']),
                            'CARACTERISTICAS_DE_VIA': int(row['CARACTERISTICAS_DE_VIA']),
                            'PERFIL_LONGITUDINAL_VIA': int(row['PERFIL_LONGITUDINAL_VIA']),
                            'SUPERFICIE_DE_CALZADA': int(row['SUPERFICIE_DE_CALZADA']),
                            'SENALIZACION': int(row['SENALIZACION']),
                            'DIA_DE_LA_SEMANA': int(row['DIA_DE_LA_SEMANA']),
                            'MES': int(row['MES']),
                            'PERIODO_DEL_DIA': int(row['PERIODO_DEL_DIA']),
                            'FERIADO': int(row['FERIADO']),
                            'ACCIDENTE': int(row['ACCIDENTE']),
                            'FECHA_SINIESTRO': fecha_siniestro,  # Fecha ya procesada
                            'FECHA_INGRESO': row['FECHA_INGRESO']
                        }
                        
                        # Crear y guardar el registro
                        siniestro = Siniestro(**siniestro_data)
                        siniestro.save()
                        records_created += 1
                        
                        if records_created % 100 == 0:
                            print(f"Insertados {records_created} registros...")
                        
                    except Exception as e:
                        records_errors += 1
                        error_details.append({
                            'row': index + 1,
                            'error': str(e),
                            'data': {k: str(v) for k, v in row.to_dict().items()}  # Convertir todo a string para evitar errores de serialización
                        })
                        
                        # Si hay demasiados errores, abortar
                        if records_errors > 10:
                            raise Exception(f"Demasiados errores en la inserción. Abortando después de {records_errors} errores.")
                
                print(f"Inserción completada. Registros creados: {records_created}, Errores: {records_errors}, Fechas corregidas: {dates_fixed}")
        
        except Exception as e:
            return Response({
                'success': False,
                'message': f'Error durante la inserción de datos: {str(e)}',
                'records_processed': records_created,
                'errors_found': records_errors,
                'dates_fixed': dates_fixed,
                'error_details': error_details[:5]  # Mostrar solo los primeros 5 errores
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        # Preparar respuesta de inserción
        insertion_result = {
            'records_created': records_created,
            'records_errors': records_errors,
            'dates_fixed': dates_fixed,
            'total_records_in_db': Siniestro.objects.count(),
            'file_processed': file_obj.name,
            'default_date_used': default_date_for_nulls
        }
        
        # Reentrenar modelo si se solicita
        retrain_result = None
        if auto_retrain and records_created > 0:
            print("Iniciando reentrenamiento del modelo...")
            try:
                # Directorio donde guardar el modelo y métricas
                output_dir = os.path.join(settings.BASE_DIR, 'projects', 'ml_model')
                os.makedirs(output_dir, exist_ok=True)
                
                # Reentrenar el modelo
                retrain_result = train_accident_model_from_db(
                    model_class=Siniestro,
                    output_dir=output_dir,
                    target_col='ACCIDENTE',
                    model_filename='modelo_accidentes.pkl',
                    metrics_filename='metricas_modelo.json'
                )
                
                print("Reentrenamiento completado exitosamente")
                
            except Exception as e:
                print(f"Error durante el reentrenamiento: {str(e)}")
                retrain_result = {
                    'success': False,
                    'message': f'Error al reentrenar el modelo: {str(e)}'
                }
        
        # Respuesta final
        response_data = {
            'success': True,
            'message': f'Datos cargados exitosamente. {records_created} registros insertados.',
            'data_insertion': insertion_result,
            'model_retrain': retrain_result if auto_retrain else {
                'message': 'Reentrenamiento no solicitado. Use auto_retrain=true para reentrenar automáticamente.'
            }
        }
        
        if records_errors > 0:
            response_data['warnings'] = {
                'message': f'{records_errors} registros tuvieron errores y no fueron insertados',
                'error_details': error_details[:3]  # Mostrar solo los primeros 3 errores
            }
        
        if dates_fixed > 0:
            response_data['info'] = {
                'message': f'{dates_fixed} fechas vacías fueron reemplazadas con la fecha por defecto: {default_date_for_nulls}'
            }
        
        return Response(response_data, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        return Response({
            'success': False,
            'message': 'Error interno del servidor durante la carga de datos',
            'error': str(e),
            'traceback': traceback.format_exc()
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def download_data_template(request):
    """
    Descarga una plantilla CSV con todos los campos necesarios para subir datos completos.
    """
    try:
        # Datos de ejemplo para inserción completa
        example_data = [
            {
                'HORA_SINIESTRO': 14,
                'CLASE_SINIESTRO': 1,
                'CANTIDAD_DE_VEHICULOS_DANADOS': 2,
                'DISTRITO': 15,
                'ZONA': 1,
                'TIPO_DE_VIA': 2,
                'RED_VIAL': 1,
                'EXISTE_CICLOVIA': 0,
                'CONDICION_CLIMATICA': 1,
                'ZONIFICACION': 2,
                'CARACTERISTICAS_DE_VIA': 1,
                'PERFIL_LONGITUDINAL_VIA': 1,
                'SUPERFICIE_DE_CALZADA': 1,
                'SENALIZACION': 1,
                'DIA_DE_LA_SEMANA': 3,
                'MES': 6,
                'PERIODO_DEL_DIA': 2,
                'FERIADO': 0,
                'ACCIDENTE': 1,
                'FECHA_SINIESTRO': '2024-06-15'
            },
            {
                'HORA_SINIESTRO': 8,
                'CLASE_SINIESTRO': 2,
                'CANTIDAD_DE_VEHICULOS_DANADOS': 1,
                'DISTRITO': 10,
                'ZONA': 2,
                'TIPO_DE_VIA': 1,
                'RED_VIAL': 2,
                'EXISTE_CICLOVIA': 1,
                'CONDICION_CLIMATICA': 2,
                'ZONIFICACION': 1,
                'CARACTERISTICAS_DE_VIA': 2,
                'PERFIL_LONGITUDINAL_VIA': 2,
                'SUPERFICIE_DE_CALZADA': 2,
                'SENALIZACION': 2,
                'DIA_DE_LA_SEMANA': 1,
                'MES': 12,
                'PERIODO_DEL_DIA': 1,
                'FERIADO': 1,
                'ACCIDENTE': 0,
                'FECHA_SINIESTRO': '2024-12-25'
            }
        ]
        
        df = pd.DataFrame(example_data)
        
        # Crear respuesta HTTP
        response = HttpResponse(content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = 'attachment; filename="plantilla_datos_completos.csv"'
        
        # Escribir CSV
        df.to_csv(response, index=False, encoding='utf-8')
        
        return response
        
    except Exception as e:
        return Response({
            'success': False,
            'message': 'Error al generar la plantilla de datos completos',
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


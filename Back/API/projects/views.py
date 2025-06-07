from django.shortcuts import render
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings
import os
import joblib
import json
import pandas as pd
from .model_trainer import train_accident_model_from_db, AccidentPredictorAPI
from .models import Siniestro
from django.http import HttpResponse

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
    """
    try:
        # Verificar que el modelo existe
        model_path = os.path.join(settings.BASE_DIR, 'projects', 'ml_model', 'modelo_accidentes.pkl')
        
        if not os.path.exists(model_path):
            return Response({
                'success': False,
                'message': 'Modelo no encontrado. Primero entrene el modelo usando /api/train-model/'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Verificar que se subió un archivo
        if 'file' not in request.FILES:
            return Response({
                'success': False,
                'message': 'No se proporcionó ningún archivo CSV',
                'required_fields': Siniestro.TRAINING_FIELDS,
                'instructions': 'Suba un archivo CSV con las columnas requeridas'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        csv_file = request.FILES['file']
        threshold = float(request.data.get('threshold', 0.5))
        
        # Validar extensión del archivo
        if not csv_file.name.endswith('.csv'):
            return Response({
                'success': False,
                'message': 'El archivo debe ser un CSV (.csv)'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Leer el archivo CSV
        try:
            # Leer CSV desde el archivo subido
            csv_data = csv_file.read().decode('utf-8')
            df = pd.read_csv(io.StringIO(csv_data))
            
            # Verificar que el DataFrame no esté vacío
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
        
        # Verificar que no haya valores nulos en las columnas requeridas
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
        
        # Seleccionar solo las columnas necesarias y en el orden correcto
        df_filtered = df[Siniestro.TRAINING_FIELDS]
        
        # Realizar predicciones
        probabilities = model.predict_proba(df_filtered)[:, 1]
        predictions = (probabilities >= threshold).astype(int)
        
        # Preparar resultados
        results = []
        for i, (pred, prob) in enumerate(zip(predictions, probabilities)):
            row_data = df_filtered.iloc[i].to_dict()
            results.append({
                'row_index': i,
                'input_data': row_data,
                'prediction': int(pred),
                'probability': float(prob),
                'risk_level': 'Alto' if prob > 0.7 else 'Medio' if prob > 0.3 else 'Bajo',
                'accident_likely': bool(pred)
            })
        
        # Estadísticas del lote
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
                'filename': csv_file.name,
                'rows_processed': len(df),
                'columns_found': list(df.columns)
            }
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'success': False,
            'message': 'Error al procesar las predicciones por lotes',
            'error': str(e)
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
        # Crear DataFrame con las columnas requeridas y algunos datos de ejemplo
        template_data = {field: [0, 1, 2] for field in Siniestro.TRAINING_FIELDS}
        
        # Datos de ejemplo más realistas
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
                'FERIADO': 0
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
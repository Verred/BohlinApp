from django.shortcuts import render
from django.http import JsonResponse, HttpResponse
from django.conf import settings
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import JSONParser, MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework import status
import json
import os
import pandas as pd
import io
from sqlalchemy import create_engine, text

from .ml_loader import predict_single, predict_batch, COLUMN_NAMES, get_model
from .models import PredictionBatch
from .model_trainer import train_and_replace_model
from .db_config import get_connection_string, DB_CONFIGS

@api_view(['GET', 'POST'])
@parser_classes([JSONParser])
def predict_view(request):
    """Vista para realizar predicciones individuales"""
    if request.method == 'GET':
        return Response({
            "message": "Envía un array de valores para obtener una predicción",
            "expected_columns": COLUMN_NAMES,
            "example": {"values": [14, 2, 1, 1, 1, 0, 0, 1, 0, 0, 1, 0, 4, 1, 1, 0]},
            "status": "success"
        })
    
    # Método POST
    try:
        data = request.data
        
        # Verificar que se haya enviado 'values'
        if 'values' not in data:
            return Response({
                "error": "La solicitud debe incluir un array 'values'",
                "status": "error"
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Obtener predicción
        result = predict_single(data['values'])
        
        # Verificar si hubo error
        if result.get('status') == 'error':
            return Response(result, status=status.HTTP_400_BAD_REQUEST)
        
        return Response(result)
    
    except Exception as e:
        return Response({
            "error": str(e),
            "status": "error"
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET', 'POST'])
@parser_classes([MultiPartParser, FormParser])
def batch_predict_view(request):
    """Vista para realizar predicciones por lotes desde un archivo CSV"""
    if request.method == 'GET':
        return Response({
            "message": "Sube un archivo CSV para obtener predicciones por lotes",
            "required_columns": COLUMN_NAMES,
            "status": "success"
        })
    
    # Método POST
    try:
        # Verificar que se haya enviado un archivo
        if 'file' not in request.FILES:
            return Response({
                "error": "Debes enviar un archivo CSV",
                "status": "error"
            }, status=status.HTTP_400_BAD_REQUEST)
        
        csv_file = request.FILES['file']
        
        # Verificar que sea un CSV
        if not csv_file.name.endswith('.csv'):
            return Response({
                "error": "El archivo debe ser CSV",
                "status": "error"
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Guardar el archivo y crear registro en la base de datos
        batch = PredictionBatch(input_file=csv_file)
        batch.save()
        
        # Ruta completa al archivo
        input_path = batch.input_file.path
        output_filename = f"resultado_{os.path.basename(input_path)}"
        output_path = os.path.join(settings.MEDIA_ROOT, 'results', output_filename)
        
        # Asegurarse de que el directorio de resultados exista
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        # Procesar el archivo
        result_path = predict_batch(input_path, output_path)
        
        if result_path:
            # Actualizar el registro con la ruta del resultado
            batch.output_file = f"results/{output_filename}"
            batch.processed = True
            batch.save()
            
            # Leer el archivo resultante para enviarlo como respuesta
            result_df = pd.read_csv(result_path)
            
            # Preparar respuesta con el archivo para descarga
            response = HttpResponse(
                open(result_path, 'rb'),
                content_type='text/csv'
            )
            response['Content-Disposition'] = f'attachment; filename="{output_filename}"'
            return response
        
        else:
            return Response({
                "error": "Error al procesar el archivo",
                "status": "error"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    except Exception as e:
        return Response({
            "error": str(e),
            "status": "error"
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def model_info_view(request):
    """Vista para obtener información sobre el modelo"""
    model = get_model()
    
    # Verificar si existen métricas guardadas
    metrics_path = os.path.join(settings.BASE_DIR, 'predictor', 'ml_model', 'model_metrics.json')
    model_metrics = None
    
    if os.path.exists(metrics_path):
        try:
            with open(metrics_path, 'r') as f:
                model_metrics = json.load(f)
        except:
            model_metrics = None
    
    return Response({
        "model_loaded": model is not None,
        "expected_columns": COLUMN_NAMES,
        "num_features": len(COLUMN_NAMES),
        "model_metrics": model_metrics,
        "endpoints": {
            "predicción individual": "/api/predict/",
            "predicción por lotes (CSV)": "/api/batch-predict/",
            "entrenamiento del modelo": "/api/train-model/"
        },
        "status": "success"
    })

@api_view(['GET', 'POST'])
@parser_classes([JSONParser])
def train_model_view(request):
    """Vista para entrenar o reentrenar el modelo desde una base de datos"""
    if request.method == 'GET':
        # Devolver información sobre las bases de datos disponibles
        return Response({
            "message": "Envia una solicitud POST para entrenar el modelo",
            "available_databases": {k: v['description'] for k, v in DB_CONFIGS.items()},
            "instructions": "Envía un JSON con el campo 'db_type' para seleccionar la base de datos y opcionalmente 'query' para una consulta personalizada",
            "example": {"db_type": "sqlite", "query": "SELECT * FROM accidentes LIMIT 1000"},
            "status": "success"
        })
    
    # Método POST
    try:
        data = request.data
        
        # Obtener tipo de base de datos
        db_type = data.get('db_type', 'sqlite')
        if db_type not in DB_CONFIGS:
            return Response({
                "error": f"Tipo de base de datos no soportado: {db_type}",
                "supported_types": list(DB_CONFIGS.keys()),
                "status": "error"
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Obtener string de conexión
        connection_string = get_connection_string(db_type)
        
        # Obtener consulta personalizada si se proporciona
        query = data.get('query')
        
        # Iniciar entrenamiento
        result = train_and_replace_model(connection_string, query)
        
        if result['status'] == 'error':
            return Response(result, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        return Response(result)
    
    except Exception as e:
        return Response({
            "error": str(e),
            "status": "error"
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
def train_model_mysql_view(request):
    """Vista para entrenar o reentrenar el modelo automáticamente usando datos de MySQL"""
    try:
        # Usar directamente MySQL sin necesidad de parámetros
        db_type = 'mysql'
        
        # Obtener string de conexión para MySQL
        connection_string = get_connection_string(db_type)
        
        # No se usa consulta personalizada, el modelo usará la consulta por defecto
        query = None
        
        # Iniciar entrenamiento
        result = train_and_replace_model(connection_string, query)
        
        if result['status'] == 'error':
            return Response(result, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        return Response({
            "status": "success",
            "message": "Modelo entrenado exitosamente con datos de MySQL",
            "details": result
        })
    
    except Exception as e:
        return Response({
            "error": str(e),
            "status": "error"
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET', 'DELETE'])
@parser_classes([JSONParser])
def database_data_view(request):
    """Vista para gestionar los datos en la base de datos"""
    # GET para obtener datos en formato JSON
    if request.method == 'GET':
        try:
            # Obtener parámetros de consulta
            db_type = request.GET.get('db_type', 'mysql')
            limit = request.GET.get('limit', 1000)
            
            if db_type not in DB_CONFIGS:
                return Response({
                    "error": f"Tipo de base de datos no soportado: {db_type}",
                    "supported_types": list(DB_CONFIGS.keys()),
                    "status": "error"
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Obtener string de conexión
            connection_string = get_connection_string(db_type)
            
            # Conectar a la base de datos
            engine = create_engine(connection_string)
            
            # Consulta
            query = f"SELECT * FROM accidentes LIMIT {limit}"
            
            # Leer datos
            df = pd.read_sql(query, engine)
            
            # Convertir a JSON
            data_json = df.to_dict(orient='records')
            
            return Response({
                "status": "success",
                "count": len(data_json),
                "data": data_json
            })
            
        except Exception as e:
            return Response({
                "error": str(e),
                "status": "error"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    # DELETE para eliminar todos los datos
    elif request.method == 'DELETE':
        try:
            data = request.data
            db_type = data.get('db_type', 'mysql')
            
            if db_type not in DB_CONFIGS:
                return Response({
                    "error": f"Tipo de base de datos no soportado: {db_type}",
                    "supported_types": list(DB_CONFIGS.keys()),
                    "status": "error"
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Obtener string de conexión
            connection_string = get_connection_string(db_type)
            
            # Conectar a la base de datos
            engine = create_engine(connection_string)
            
            # Eliminar todos los registros
            with engine.connect() as conn:
                conn.execute(text("DELETE FROM accidentes"))
                conn.commit()
            
            return Response({
                "status": "success",
                "message": "Todos los datos han sido eliminados de la tabla accidentes"
            })
            
        except Exception as e:
            return Response({
                "error": str(e),
                "status": "error"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def download_csv_view(request):
    """Vista para descargar todos los datos en formato CSV"""
    try:
        # Obtener parámetros de consulta
        db_type = request.GET.get('db_type', 'mysql')
        
        if db_type not in DB_CONFIGS:
            return Response({
                "error": f"Tipo de base de datos no soportado: {db_type}",
                "supported_types": list(DB_CONFIGS.keys()),
                "status": "error"
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Obtener string de conexión
        connection_string = get_connection_string(db_type)
        
        # Conectar a la base de datos
        engine = create_engine(connection_string)
        
        # Leer datos
        df = pd.read_sql("SELECT * FROM accidentes", engine)
        
        # Generar CSV en memoria
        csv_buffer = io.StringIO()
        df.to_csv(csv_buffer, index=False)
        csv_buffer.seek(0)
        
        # Preparar respuesta
        response = HttpResponse(csv_buffer.getvalue(), content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="accidentes_data.csv"'
        
        return response
        
    except Exception as e:
        return Response({
            "error": str(e),
            "status": "error"
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
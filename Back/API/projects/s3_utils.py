import boto3
import json
import joblib
import io
import os
from botocore.exceptions import ClientError, NoCredentialsError
from django.conf import settings
import tempfile

"""
Utilidades para el manejo de archivos en S3 para modelos de ML.
"""

class S3ModelStorage:
    """Clase para manejar el almacenamiento de modelos ML en S3."""
    
    def __init__(self):
        """Inicializa el cliente S3 con configuración de Django."""
        try:
            self.s3_client = boto3.client(
                's3',
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                region_name=settings.AWS_S3_REGION
            )
            self.bucket_name = settings.AWS_S3_BUCKET_NAME
            self.prefix = settings.AWS_S3_ML_MODEL_PREFIX
            
            # Verificar conectividad
            self._test_connection()
            
        except Exception as e:
            raise Exception(f"Error al inicializar S3: {str(e)}")
    
    def _test_connection(self):
        """Verifica la conexión con S3."""
        try:
            self.s3_client.head_bucket(Bucket=self.bucket_name)
        except ClientError as e:
            error_code = e.response['Error']['Code']
            if error_code == '404':
                raise Exception(f"Bucket '{self.bucket_name}' no encontrado")
            else:
                raise Exception(f"Error de acceso al bucket: {error_code}")
        except NoCredentialsError:
            raise Exception("Credenciales AWS no configuradas")
    
    def save_model(self, model, filename='modelo_accidentes.pkl'):
        """
        Guarda un modelo en S3.
        
        Args:
            model: Modelo a guardar
            filename (str): Nombre del archivo
            
        Returns:
            str: Ruta S3 del modelo guardado
        """
        try:
            # Serializar modelo en memoria
            buffer = io.BytesIO()
            joblib.dump(model, buffer)
            buffer.seek(0)
            
            # Construir key S3
            s3_key = f"{self.prefix}{filename}"
            
            # Subir a S3
            self.s3_client.upload_fileobj(
                buffer,
                self.bucket_name,
                s3_key,
                ExtraArgs={'ContentType': 'application/octet-stream'}
            )
            
            s3_path = f"s3://{self.bucket_name}/{s3_key}"
            print(f"Modelo guardado en S3: {s3_path}")
            
            return s3_path
            
        except Exception as e:
            raise Exception(f"Error al guardar modelo en S3: {str(e)}")
    
    def load_model(self, filename='modelo_accidentes.pkl'):
        """
        Carga un modelo desde S3.
        
        Args:
            filename (str): Nombre del archivo
            
        Returns:
            Modelo cargado
        """
        try:
            # Construir key S3
            s3_key = f"{self.prefix}{filename}"
            
            # Descargar desde S3 a memoria
            buffer = io.BytesIO()
            self.s3_client.download_fileobj(self.bucket_name, s3_key, buffer)
            buffer.seek(0)
            
            # Cargar modelo
            model = joblib.load(buffer)
            
            print(f"Modelo cargado desde S3: s3://{self.bucket_name}/{s3_key}")
            return model
            
        except ClientError as e:
            if e.response['Error']['Code'] == 'NoSuchKey':
                raise FileNotFoundError(f"Modelo no encontrado en S3: {filename}")
            else:
                raise Exception(f"Error al cargar modelo desde S3: {str(e)}")
        except Exception as e:
            raise Exception(f"Error al procesar modelo desde S3: {str(e)}")
    
    def save_metrics(self, metrics_dict, filename='metricas_modelo.json'):
        """
        Guarda métricas en S3.
        
        Args:
            metrics_dict (dict): Métricas a guardar
            filename (str): Nombre del archivo
            
        Returns:
            str: Ruta S3 de las métricas guardadas
        """
        try:
            # Construir key S3
            s3_key = f"{self.prefix}{filename}"
            
            # Convertir a JSON
            json_data = json.dumps(metrics_dict, indent=2, ensure_ascii=False)
            
            # Subir a S3
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=s3_key,
                Body=json_data.encode('utf-8'),
                ContentType='application/json'
            )
            
            s3_path = f"s3://{self.bucket_name}/{s3_key}"
            print(f"Métricas guardadas en S3: {s3_path}")
            
            return s3_path
            
        except Exception as e:
            raise Exception(f"Error al guardar métricas en S3: {str(e)}")
    
    def load_metrics(self, filename='metricas_modelo.json'):
        """
        Carga métricas desde S3.
        
        Args:
            filename (str): Nombre del archivo
            
        Returns:
            dict: Métricas cargadas
        """
        try:
            # Construir key S3
            s3_key = f"{self.prefix}{filename}"
            
            # Descargar desde S3
            response = self.s3_client.get_object(Bucket=self.bucket_name, Key=s3_key)
            json_data = response['Body'].read().decode('utf-8')
            
            # Parsear JSON
            metrics = json.loads(json_data)
            
            print(f"Métricas cargadas desde S3: s3://{self.bucket_name}/{s3_key}")
            return metrics
            
        except ClientError as e:
            if e.response['Error']['Code'] == 'NoSuchKey':
                raise FileNotFoundError(f"Métricas no encontradas en S3: {filename}")
            else:
                raise Exception(f"Error al cargar métricas desde S3: {str(e)}")
        except Exception as e:
            raise Exception(f"Error al procesar métricas desde S3: {str(e)}")
    
    def model_exists(self, filename='modelo_accidentes.pkl'):
        """
        Verifica si un modelo existe en S3.
        
        Args:
            filename (str): Nombre del archivo
            
        Returns:
            bool: True si existe, False si no
        """
        try:
            s3_key = f"{self.prefix}{filename}"
            self.s3_client.head_object(Bucket=self.bucket_name, Key=s3_key)
            return True
        except ClientError:
            return False
    
    def metrics_exist(self, filename='metricas_modelo.json'):
        """
        Verifica si las métricas existen en S3.
        
        Args:
            filename (str): Nombre del archivo
            
        Returns:
            bool: True si existen, False si no
        """
        try:
            s3_key = f"{self.prefix}{filename}"
            self.s3_client.head_object(Bucket=self.bucket_name, Key=s3_key)
            return True
        except ClientError:
            return False
    
    def get_model_info(self, filename='modelo_accidentes.pkl'):
        """
        Obtiene información de un modelo en S3.
        
        Args:
            filename (str): Nombre del archivo
            
        Returns:
            dict: Información del modelo
        """
        try:
            s3_key = f"{self.prefix}{filename}"
            response = self.s3_client.head_object(Bucket=self.bucket_name, Key=s3_key)
            
            return {
                'exists': True,
                'size_bytes': response['ContentLength'],
                'size_mb': round(response['ContentLength'] / (1024 * 1024), 2),
                'last_modified': response['LastModified'].isoformat(),
                's3_path': f"s3://{self.bucket_name}/{s3_key}"
            }
        except ClientError:
            return {
                'exists': False,
                'size_bytes': 0,
                'size_mb': 0,
                'last_modified': None,
                's3_path': None
            }


def get_storage_handler():
    """
    Retorna el manejador de almacenamiento apropiado según la configuración.
    
    Returns:
        LocalModelStorage o S3ModelStorage
    """
    if getattr(settings, 'USE_S3_STORAGE', False):
        return S3ModelStorage()
    else:
        return LocalModelStorage()


class LocalModelStorage:
    """Clase para manejar el almacenamiento local (compatibilidad)."""
    
    def __init__(self):
        self.output_dir = os.path.join(settings.BASE_DIR, 'projects', 'ml_model')
        os.makedirs(self.output_dir, exist_ok=True)
    
    def save_model(self, model, filename='modelo_accidentes.pkl'):
        model_path = os.path.join(self.output_dir, filename)
        joblib.dump(model, model_path)
        return model_path
    
    def load_model(self, filename='modelo_accidentes.pkl'):
        model_path = os.path.join(self.output_dir, filename)
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Modelo no encontrado: {model_path}")
        return joblib.load(model_path)
    
    def save_metrics(self, metrics_dict, filename='metricas_modelo.json'):
        metrics_path = os.path.join(self.output_dir, filename)
        with open(metrics_path, 'w', encoding='utf-8') as f:
            json.dump(metrics_dict, f, indent=2, ensure_ascii=False)
        return metrics_path
    
    def load_metrics(self, filename='metricas_modelo.json'):
        metrics_path = os.path.join(self.output_dir, filename)
        if not os.path.exists(metrics_path):
            raise FileNotFoundError(f"Métricas no encontradas: {metrics_path}")
        with open(metrics_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    def model_exists(self, filename='modelo_accidentes.pkl'):
        model_path = os.path.join(self.output_dir, filename)
        return os.path.exists(model_path)
    
    def metrics_exist(self, filename='metricas_modelo.json'):
        metrics_path = os.path.join(self.output_dir, filename)
        return os.path.exists(metrics_path)
    
    def get_model_info(self, filename='modelo_accidentes.pkl'):
        model_path = os.path.join(self.output_dir, filename)
        if os.path.exists(model_path):
            size_bytes = os.path.getsize(model_path)
            return {
                'exists': True,
                'size_bytes': size_bytes,
                'size_mb': round(size_bytes / (1024 * 1024), 2),
                'last_modified': None,
                'local_path': model_path
            }
        else:
            return {
                'exists': False,
                'size_bytes': 0,
                'size_mb': 0,
                'last_modified': None,
                'local_path': None
            }
"""
URL configuration for accidentes_api project.
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework import status
import os
import sys

# Agregar el directorio raíz del proyecto al path de Python
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Importar las vistas del módulo predictor
from predictor import views

# Importar desde predictor en lugar de scripts
from predictor.model_trainer import train_and_replace_model
from predictor.db_config import get_connection_string

# Esta importación debe estar en un módulo accesible
# Si tienes un script separado, asegúrate de que esté en el path correcto
try:
    from scripts.import_data_to_mysql import import_csv_to_mysql
except ImportError:
    # Si no encuentras el módulo, puedes definir una función temporal aquí
    def import_csv_to_mysql(csv_path, connection_string):
        """
        Función temporal para importar CSV a MySQL.
        Reemplazar esto con la implementación real más tarde.
        """
        try:
            import pandas as pd
            from sqlalchemy import create_engine
            
            # Crear motor de conexión
            engine = create_engine(connection_string)
            
            # Leer CSV
            df = pd.read_csv(csv_path)
            
            # Guardar en MySQL
            df.to_sql('accidentes', con=engine, if_exists='append', index=False)
            
            return True
        except Exception as e:
            print(f"Error al importar datos: {e}")
            return False

@api_view(['GET', 'POST'])
@parser_classes([MultiPartParser, FormParser])
def upload_and_train_view(request):
    """Vista para subir un CSV, importarlo a la base de datos y entrenar el modelo"""
    if request.method == 'GET':
        return Response({
            "message": "Sube un archivo CSV para importar a la base de datos y entrenar el modelo",
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
        
        # Guardar el archivo temporalmente
        temp_file_path = os.path.join(settings.MEDIA_ROOT, 'temp', csv_file.name)
        os.makedirs(os.path.dirname(temp_file_path), exist_ok=True)
        
        with open(temp_file_path, 'wb+') as temp_file:
            for chunk in csv_file.chunks():
                temp_file.write(chunk)
        
        # Importar datos a MySQL
        connection_string = get_connection_string('mysql')
        import_success = import_csv_to_mysql(temp_file_path, connection_string)
        
        if not import_success:
            return Response({
                "error": "Error al importar datos a la base de datos",
                "status": "error"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        # Entrenar modelo con los datos importados
        result = train_and_replace_model(connection_string)
        
        # Eliminar archivo temporal
        try:
            os.remove(temp_file_path)
        except:
            pass
        
        return Response(result)
    
    except Exception as e:
        return Response({
            "error": str(e),
            "status": "error"
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('predictor.urls')),
    path('predict/', views.predict_view, name='predict'),
    path('batch-predict/', views.batch_predict_view, name='batch_predict'),
    path('model-info/', views.model_info_view, name='model_info'),
    path('train-model/', views.train_model_view, name='train_model'),
    path('upload-and-train/', upload_and_train_view, name='upload_and_train'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

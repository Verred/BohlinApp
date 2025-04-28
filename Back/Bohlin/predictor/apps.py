from django.apps import AppConfig
import os
from django.conf import settings


class PredictorConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'predictor'
    
    def ready(self):
        # Asegurar que existan los directorios necesarios
        os.makedirs(os.path.join(settings.BASE_DIR, 'predictor', 'ml_model'), exist_ok=True)
        os.makedirs(os.path.join(settings.BASE_DIR, 'data'), exist_ok=True)
        os.makedirs(os.path.join(settings.MEDIA_ROOT, 'results'), exist_ok=True)
        
        # Cargar el modelo
        from .ml_loader import load_model
        load_model()

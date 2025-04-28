from django.db import models
import uuid
import os

def csv_upload_path(instance, filename):
    """Genera una ruta personalizada para los archivos CSV subidos"""
    ext = filename.split('.')[-1]
    filename = f"{uuid.uuid4()}.{ext}"
    return os.path.join('csv_files/', filename)

class PredictionBatch(models.Model):
    """Modelo para almacenar los lotes de predicciones"""
    input_file = models.FileField(upload_to=csv_upload_path)
    output_file = models.FileField(upload_to='results/', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    processed = models.BooleanField(default=False)
    
    def __str__(self):
        return f"Lote {self.id} - {self.created_at.strftime('%Y-%m-%d %H:%M')}"
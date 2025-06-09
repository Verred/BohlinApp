from django.db import models

class Siniestro(models.Model):
    HORA_SINIESTRO = models.IntegerField()
    CLASE_SINIESTRO = models.IntegerField()
    CANTIDAD_DE_VEHICULOS_DANADOS = models.IntegerField()
    DISTRITO = models.IntegerField()
    ZONA = models.IntegerField()
    TIPO_DE_VIA = models.IntegerField()
    RED_VIAL = models.IntegerField()
    EXISTE_CICLOVIA = models.IntegerField()
    CONDICION_CLIMATICA = models.IntegerField()
    ZONIFICACION = models.IntegerField()
    CARACTERISTICAS_DE_VIA = models.IntegerField()
    PERFIL_LONGITUDINAL_VIA = models.IntegerField()
    SUPERFICIE_DE_CALZADA = models.IntegerField()
    SENALIZACION = models.IntegerField()
    DIA_DE_LA_SEMANA = models.IntegerField()
    MES = models.IntegerField()
    PERIODO_DEL_DIA = models.IntegerField()
    FERIADO = models.IntegerField()
    ACCIDENTE = models.IntegerField()
    FECHA_SINIESTRO = models.DateField()
    FECHA_INGRESO = models.DateField()

    # Campos que se usan para entrenamiento y predicción
    TRAINING_FIELDS = [
        'HORA_SINIESTRO', 'CLASE_SINIESTRO', 'CANTIDAD_DE_VEHICULOS_DANADOS',
        'DISTRITO', 'ZONA', 'TIPO_DE_VIA', 'RED_VIAL', 'EXISTE_CICLOVIA',
        'CONDICION_CLIMATICA', 'ZONIFICACION', 'CARACTERISTICAS_DE_VIA',
        'PERFIL_LONGITUDINAL_VIA', 'SUPERFICIE_DE_CALZADA', 'SENALIZACION',
        'DIA_DE_LA_SEMANA', 'MES', 'PERIODO_DEL_DIA', 'FERIADO'
    ]
    
    # Campo objetivo para el entrenamiento
    TARGET_FIELD = 'ACCIDENTE'
    
    class Meta:
        db_table = 'projects_siniestro'
        
    def __str__(self):
        return f"Siniestro {self.id} - Accidente: {self.ACCIDENTE}"

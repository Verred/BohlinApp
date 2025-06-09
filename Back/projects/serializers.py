from rest_framework import serializers
from .models import Siniestro

class SiniestroSerializer(serializers.ModelSerializer):
    class Meta:
        model = Siniestro
        fields = '__all__'  # Serialize all fields of the Siniestro model
        read_only_fields = ['id', 'fecha_ingreso']  # Make 'id' and 'fecha_ingreso' read-only
        
from .models import Siniestro
from rest_framework import viewsets, permissions
from .serializers import SiniestroSerializer

class SiniestroViewSet(viewsets.ModelViewSet):
    queryset = Siniestro.objects.all()
    permission_classes = [permissions.AllowAny]  # Allow any user to access this viewset
    serializer_class = SiniestroSerializer
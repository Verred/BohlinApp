from .models import Siniestro
from rest_framework import viewsets, permissions, status
from .serializers import SiniestroSerializer
from rest_framework.decorators import action 
from rest_framework.response import Response 

class SiniestroViewSet(viewsets.ModelViewSet):
    queryset = Siniestro.objects.all()
    permission_classes = [permissions.AllowAny] 
    serializer_class = SiniestroSerializer

    @action(detail=False, methods=['get'])
    def accidentes(self, request):
        """
        Obtiene todos los siniestros donde ACCIDENTE = 1
        """
        siniestros_con_accidente = Siniestro.objects.filter(ACCIDENTE=1)
        serializer = self.get_serializer(siniestros_con_accidente, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['delete']) 
    def delete_all(self, request):
        """
        Elimina todos los registros de siniestros.
        """
        Siniestro.objects.all().delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
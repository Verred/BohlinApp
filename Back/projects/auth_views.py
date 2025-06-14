from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView
from django.contrib.auth.models import User
from .auth_serializers import LoginSerializer, ChangePasswordSerializer, UserProfileSerializer

@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    """
    Autentica a un usuario y devuelve tokens JWT.
    """
    try:
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.validated_data['user']
            
            # Generar tokens JWT
            refresh = RefreshToken.for_user(user)
            access_token = str(refresh.access_token)
            refresh_token = str(refresh)
            
            # Actualizar last_login
            user.last_login = user.last_login
            user.save()
            
            return Response({
                'success': True,
                'message': 'Login exitoso',
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                },
                'tokens': {
                    'access': access_token,
                    'refresh': refresh_token,
                }
            }, status=status.HTTP_200_OK)
        else:
            return Response({
                'success': False,
                'message': 'Datos inválidos',
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
            
    except Exception as e:
        return Response({
            'success': False,
            'message': 'Error interno del servidor',
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password_view(request):
    """
    Permite a un usuario autenticado cambiar su contraseña.
    """
    try:
        serializer = ChangePasswordSerializer(
            data=request.data,
            context={'request': request}
        )
        
        if serializer.is_valid():
            serializer.save()
            
            return Response({
                'success': True,
                'message': 'Contraseña cambiada exitosamente',
                'note': 'Deberá iniciar sesión nuevamente con su nueva contraseña'
            }, status=status.HTTP_200_OK)
        else:
            return Response({
                'success': False,
                'message': 'Datos inválidos',
                'errors': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
            
    except Exception as e:
        return Response({
            'success': False,
            'message': 'Error interno del servidor',
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def profile_view(request):
    """
    Obtiene el perfil del usuario autenticado.
    """
    try:
        serializer = UserProfileSerializer(request.user)
        return Response({
            'success': True,
            'user': serializer.data
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'success': False,
            'message': 'Error interno del servidor',
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    """
    Logout del usuario (invalida el refresh token).
    """
    try:
        refresh_token = request.data.get('refresh_token')
        if refresh_token:
            token = RefreshToken(refresh_token)
            token.blacklist()
            
        return Response({
            'success': True,
            'message': 'Logout exitoso'
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({
            'success': True,
            'message': 'Logout realizado (token ya inválido)',
        }, status=status.HTTP_200_OK)
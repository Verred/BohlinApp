from rest_framework import routers
from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .api import SiniestroViewSet
from . import views
from . import auth_views

router = routers.DefaultRouter()

router.register('api/siniestros', SiniestroViewSet, basename='siniestros')

urlpatterns = [
    # Autenticación JWT
    path('api/auth/login/', auth_views.login_view, name='login'),
    path('api/auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/auth/logout/', auth_views.logout_view, name='logout'),
    path('api/auth/change-password/', auth_views.change_password_view, name='change_password'),
    path('api/auth/profile/', auth_views.profile_view, name='profile'),
    
    # Endpoints existentes de ML
    path('api/train-model/', views.train_model, name='train_model'),
    path('api/predict/', views.predict, name='predict'),
    path('api/model-info/', views.model_info, name='model_info'),
    path('api/batch-predict/', views.batch_predict, name='batch_predict'),
    path('api/download-csv/', views.download_csv, name='download_csv'),
    path('api/download-template/', views.download_template_csv, name='download_template_csv'),
    path('api/upload-and-train/', views.upload_and_retrain, name='upload_and_retrain'), 
    path('api/download-data-template/', views.download_data_template, name='download_data_template'),
] + router.urls

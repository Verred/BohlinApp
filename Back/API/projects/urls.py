from rest_framework import routers
from django.urls import path
from .api import SiniestroViewSet
from . import views

router = routers.DefaultRouter()

router.register('api/siniestros', SiniestroViewSet, basename='siniestros')

urlpatterns = [
    path('api/train-model/', views.train_model, name='train_model'),
    path('api/predict/', views.predict, name='predict'),
    path('api/model-info/', views.model_info, name='model_info'),
    path('api/batch-predict/', views.batch_predict, name='batch_predict'),
    path('api/download-csv/', views.download_csv, name='download_csv'),
    path('api/download-template/', views.download_template_csv, name='download_template_csv'),
] + router.urls

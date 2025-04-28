from django.urls import path
from . import views

urlpatterns = [
    # Rutas existentes
    path('predict/', views.predict_view, name='predict'),
    path('batch-predict/', views.batch_predict_view, name='batch_predict'),
    path('model-info/', views.model_info_view, name='model_info'),
    path('train-model/', views.train_model_view, name='train_model'),
    
    # Nuevas rutas
    path('database-data/', views.database_data_view, name='database_data'),
    path('download-csv/', views.download_csv_view, name='download_csv'),
    
    # Ruta para entrenamiento automático con MySQL
    path('train-mysql/', views.train_model_mysql_view, name='train_model_mysql'),
]
"""
Módulo para la creación y evaluación del modelo de predicción de accidentes de tránsito para Django API.
Este módulo se encarga de:
1. Cargar los datos procesados desde la base de datos
2. Entrenar un modelo de Random Forest
3. Evaluar el rendimiento del modelo
4. Guardar las métricas en JSON
5. Guardar el modelo entrenado
"""

import pandas as pd
import numpy as np
import os
import joblib
import json
from datetime import datetime
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split, cross_val_score, GridSearchCV, StratifiedKFold
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score, 
    roc_auc_score, confusion_matrix, classification_report, roc_curve
)
from imblearn.over_sampling import SMOTE
from collections import Counter

class AccidentPredictorAPI:
    def __init__(self):
        """Inicializa el predictor de accidentes para API Django."""
        self.data = None
        self.X = None
        self.y = None
        self.X_train = None
        self.X_test = None
        self.y_train = None
        self.y_test = None
        self.rf_model = None
        self.feature_importance = None
        self.metrics = {}
        # Columnas excluidas del entrenamiento
        self.excluded_columns = ['FECHA_SINIESTRO', 'FECHA_INGRESO', 'id']
    
    def load_data_from_model(self, model_class, filter_kwargs=None):
        """Carga datos desde un modelo de Django excluyendo columnas específicas.
        
        Args:
            model_class: Clase del modelo Django.
            filter_kwargs (dict, optional): Filtros para la consulta.
        """
        from django.forms.models import model_to_dict
        import pandas as pd
        
        # Obtener queryset
        if filter_kwargs:
            queryset = model_class.objects.filter(**filter_kwargs)
        else:
            queryset = model_class.objects.all()
        
        # Convertir a lista de diccionarios
        data_list = []
        for obj in queryset:
            obj_dict = model_to_dict(obj)
            # Excluir columnas no deseadas
            filtered_dict = {k: v for k, v in obj_dict.items() 
                           if k not in self.excluded_columns}
            data_list.append(filtered_dict)
        
        # Convertir a DataFrame
        self.data = pd.DataFrame(data_list)
        
        if self.data.empty:
            raise ValueError("No se encontraron datos en la base de datos")
        
        print(f"Datos cargados: {len(self.data)} registros")
        print(f"Columnas utilizadas: {list(self.data.columns)}")
        
        return self
    
    def load_data_from_db(self, queryset):
        """Carga datos desde un QuerySet de Django excluyendo columnas específicas.
        
        Args:
            queryset: QuerySet de Django.
        """
        from django.forms.models import model_to_dict
        import pandas as pd
        
        # Convertir queryset a lista de diccionarios
        data_list = []
        for obj in queryset:
            obj_dict = model_to_dict(obj)
            # Excluir columnas no deseadas
            filtered_dict = {k: v for k, v in obj_dict.items() 
                           if k not in self.excluded_columns}
            data_list.append(filtered_dict)
        
        # Convertir a DataFrame
        self.data = pd.DataFrame(data_list)
        
        if self.data.empty:
            raise ValueError("No se encontraron datos en el QuerySet")
        
        print(f"Datos cargados: {len(self.data)} registros")
        print(f"Columnas utilizadas: {list(self.data.columns)}")
        
        return self
    
    def prepare_data(self, target_col='ACCIDENTE', test_size=0.2, random_state=42):
        """Prepara los datos para el entrenamiento dividiendo en conjuntos de entrenamiento y prueba.
        
        Args:
            target_col (str): Nombre de la columna objetivo.
            test_size (float): Proporción de datos para el conjunto de prueba.
            random_state (int): Semilla para reproducibilidad.
            
        Returns:
            self: Para encadenamiento de métodos.
        """
        if self.data is None:
            raise ValueError("Primero debe cargar los datos")
        
        # Ajustar el nombre de la columna objetivo si es necesario
        if target_col.upper() not in self.data.columns and target_col not in self.data.columns:
            valid_options = [col for col in self.data.columns if 'ACCIDENTE' in col.upper()]
            if valid_options:
                target_col = valid_options[0]
                print(f"Columna objetivo ajustada a '{target_col}'")
            else:
                raise ValueError(f"Columna objetivo '{target_col}' no encontrada.")
        
        # Separar características y variable objetivo
        self.X = self.data.drop(target_col, axis=1)
        self.y = self.data[target_col]
        
        print(f"\nCaracterísticas seleccionadas: {self.X.columns.tolist()}")
        print(f"Distribución de la variable objetivo:\n{self.y.value_counts()}")
        
        # Dividir en conjuntos de entrenamiento y prueba
        self.X_train, self.X_test, self.y_train, self.y_test = train_test_split(
            self.X, self.y, test_size=test_size, random_state=random_state, stratify=self.y
        )
        
        print(f"\nConjunto de entrenamiento: {len(self.X_train)} muestras")
        print(f"Conjunto de prueba: {len(self.X_test)} muestras")
        
        return self
    
    def apply_smote(self, random_state=42):
        """Aplica SMOTE para equilibrar las clases en el conjunto de entrenamiento.
        
        Args:
            random_state (int): Semilla para reproducibilidad.
            
        Returns:
            self: Para encadenamiento de métodos.
        """
        if self.X_train is None or self.y_train is None:
            raise ValueError("Primero debe preparar los datos con prepare_data()")
        
        # Aplicar SMOTE al conjunto de entrenamiento
        smote = SMOTE(random_state=random_state)
        self.X_train_smote, self.y_train_smote = smote.fit_resample(self.X_train, self.y_train)
        
        # Verificar distribución después de SMOTE
        print("\nDistribución después de SMOTE:")
        print(Counter(self.y_train_smote))
        
        return self
    
    def train_model(self, use_smote=True, hyperparams=None):
        """Entrena un modelo de Random Forest con los datos preparados.
        
        Args:
            use_smote (bool): Si es True, usa los datos balanceados con SMOTE.
            hyperparams (dict, optional): Hiperparámetros para el modelo.
            
        Returns:
            self: Para encadenamiento de métodos.
        """
        if hyperparams is None:
            hyperparams = {
                'n_estimators': 100,
                'max_depth': 10,
                'min_samples_split': 15,
                'min_samples_leaf': 5,
                'max_features': 'sqrt',
                'bootstrap': True,
                'oob_score': True,
                'random_state': 42,
                'class_weight': 'balanced'
            }
        
        # Crear modelo
        self.rf_model = RandomForestClassifier(**hyperparams)
        
        # Entrenar modelo
        if use_smote:
            if not hasattr(self, 'X_train_smote') or not hasattr(self, 'y_train_smote'):
                self.apply_smote()
            self.rf_model.fit(self.X_train_smote, self.y_train_smote)
            print("\nModelo entrenado con datos balanceados (SMOTE)")
        else:
            self.rf_model.fit(self.X_train, self.y_train)
            print("\nModelo entrenado con datos originales")
        
        return self
    
    def evaluate_model(self, threshold=0.5):
        """Evalúa el rendimiento del modelo en el conjunto de prueba.
        
        Args:
            threshold (float): Umbral de probabilidad para clasificación.
            
        Returns:
            self: Para encadenamiento de métodos.
        """
        if self.rf_model is None:
            raise ValueError("Primero debe entrenar el modelo con train_model()")
        
        # Realizar predicciones
        self.y_prob = self.rf_model.predict_proba(self.X_test)[:, 1]
        self.y_pred = (self.y_prob >= threshold).astype(int)
        
        # Calcular métricas de rendimiento
        cm = confusion_matrix(self.y_test, self.y_pred)
        tn, fp, fn, tp = cm.ravel()
        
        self.metrics = {
            'timestamp': datetime.now().isoformat(),
            'training_date': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'threshold': threshold,
            'accuracy': float(accuracy_score(self.y_test, self.y_pred)),
            'precision': float(precision_score(self.y_test, self.y_pred)),
            'recall': float(recall_score(self.y_test, self.y_pred)),
            'f1_score': float(f1_score(self.y_test, self.y_pred)),
            'roc_auc': float(roc_auc_score(self.y_test, self.y_prob)),
            'confusion_matrix': {
                'true_negatives': int(tn),
                'false_positives': int(fp),
                'false_negatives': int(fn),
                'true_positives': int(tp)
            },
            'dataset_info': {
                'total_samples': len(self.data),
                'training_samples': len(self.X_train),
                'test_samples': len(self.X_test),
                'features_count': len(self.X.columns),
                'target_distribution': self.y.value_counts().to_dict()
            }
        }
        
        # Agregar OOB score si está disponible --> Omitido por ahora by Verred
        # if hasattr(self.rf_model, 'oob_score_'):
        #     self.metrics['oob_score'] = float(self.rf_model.oob_score_)
        
        # Guardar importancia de características
        self.feature_importance = pd.DataFrame({
            'Feature': self.X.columns,
            'Importance': self.rf_model.feature_importances_
        }).sort_values('Importance', ascending=False)
        
        # Agregar top 10 características importantes a las métricas
        self.metrics['top_features'] = [
            {
                'feature': row['Feature'],
                'importance': float(row['Importance'])
            }
            for _, row in self.feature_importance.head(10).iterrows()
        ]
        
        print("\n---- Evaluación del Modelo ----")
        for key, value in self.metrics.items():
            if key not in ['timestamp', 'training_date', 'confusion_matrix', 'dataset_info', 'top_features']:
                print(f"{key}: {value}")
        
        return self
    
    def save_metrics_json(self, metrics_path):
        """Guarda las métricas del modelo en formato JSON.
        
        Args:
            metrics_path (str): Ruta donde guardar las métricas.
            
        Returns:
            str: Ruta del archivo de métricas guardado.
        """
        if not self.metrics:
            raise ValueError("Primero debe evaluar el modelo")
        
        # Asegurar que el directorio existe
        os.makedirs(os.path.dirname(metrics_path), exist_ok=True)
        
        # Guardar métricas en JSON
        with open(metrics_path, 'w', encoding='utf-8') as f:
            json.dump(self.metrics, f, indent=2, ensure_ascii=False)
        
        print(f"\nMétricas guardadas en: {metrics_path}")
        return metrics_path
    
    def save_model(self, model_path):
        """Guarda el modelo entrenado.
        
        Args:
            model_path (str): Ruta donde guardar el modelo.
            
        Returns:
            str: Ruta del modelo guardado.
        """
        if self.rf_model is None:
            raise ValueError("Primero debe entrenar el modelo")
        
        # Asegurar que el directorio existe
        os.makedirs(os.path.dirname(model_path), exist_ok=True)
        
        # Guardar el modelo
        joblib.dump(self.rf_model, model_path)
        print(f"\nModelo guardado en: {model_path}")
        
        return model_path
    
    def predict_new_data(self, new_data, threshold=0.5):
        """Realiza predicciones para nuevos datos.
        
        Args:
            new_data (pd.DataFrame): Nuevos datos para predecir.
            threshold (float): Umbral de probabilidad para clasificación.
            
        Returns:
            tuple: (predicciones, probabilidades)
        """
        if self.rf_model is None:
            raise ValueError("Primero debe entrenar el modelo")
        
        # Verificar que las columnas coincidan
        missing_cols = set(self.X.columns) - set(new_data.columns)
        if missing_cols:
            raise ValueError(f"Faltan columnas en los nuevos datos: {missing_cols}")
        
        # Reordenar columnas para que coincidan con el orden del modelo
        new_data = new_data[self.X.columns]
        
        # Realizar predicciones
        probabilities = self.rf_model.predict_proba(new_data)[:, 1]
        predictions = (probabilities >= threshold).astype(int)
        
        return predictions, probabilities
    
    def get_metrics(self):
        """Retorna las métricas del modelo.
        
        Returns:
            dict: Diccionario con las métricas del modelo.
        """
        return self.metrics
    
    def train_and_evaluate(self, queryset_or_model, target_col='ACCIDENTE', 
                          model_path=None, metrics_path=None, filter_kwargs=None):
        """Método completo para entrenar y evaluar el modelo desde la API.
        
        Args:
            queryset_or_model: QuerySet de Django o clase del modelo.
            target_col (str): Nombre de la columna objetivo.
            model_path (str, optional): Ruta donde guardar el modelo.
            metrics_path (str, optional): Ruta donde guardar las métricas.
            filter_kwargs (dict, optional): Filtros para la consulta.
            
        Returns:
            dict: Diccionario con las rutas de los archivos guardados y métricas.
        """
        try:
            # Cargar datos
            if hasattr(queryset_or_model, 'objects'):  # Es una clase de modelo
                self.load_data_from_model(queryset_or_model, filter_kwargs)
            else:  # Es un QuerySet
                self.load_data_from_db(queryset_or_model)
            
            # Preparar, entrenar y evaluar
            self.prepare_data(target_col=target_col) \
                .apply_smote() \
                .train_model() \
                .evaluate_model()
            
            result = {
                'success': True,
                'metrics': self.metrics,
                'message': 'Modelo entrenado y evaluado exitosamente'
            }
            
            # Guardar modelo si se especifica la ruta
            if model_path:
                saved_model_path = self.save_model(model_path)
                result['model_path'] = saved_model_path
            
            # Guardar métricas si se especifica la ruta
            if metrics_path:
                saved_metrics_path = self.save_metrics_json(metrics_path)
                result['metrics_path'] = saved_metrics_path
            
            return result
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'message': 'Error durante el entrenamiento del modelo'
            }

# Función de utilidad actualizada para manejar exclusión de columnas
def train_accident_model_from_db(model_class, output_dir, target_col='ACCIDENTE', 
                                filter_kwargs=None, model_filename='modelo_accidentes.pkl',
                                metrics_filename='metricas_modelo.json',
                                excluded_columns=None):
    """Función de utilidad para entrenar el modelo desde una vista de Django.
    
    Args:
        model_class: Clase del modelo Django con los datos.
        output_dir (str): Directorio donde guardar el modelo y métricas.
        target_col (str): Nombre de la columna objetivo.
        filter_kwargs (dict, optional): Filtros para la consulta.
        model_filename (str): Nombre del archivo del modelo.
        metrics_filename (str): Nombre del archivo de métricas.
        excluded_columns (list, optional): Columnas a excluir del entrenamiento.
        
    Returns:
        dict: Resultado del entrenamiento con rutas y métricas.
    """
    predictor = AccidentPredictorAPI()
    
    # Configurar columnas excluidas si se proporcionan
    if excluded_columns:
        predictor.excluded_columns.extend(excluded_columns)
    
    model_path = os.path.join(output_dir, model_filename)
    metrics_path = os.path.join(output_dir, metrics_filename)
    
    return predictor.train_and_evaluate(
        queryset_or_model=model_class,
        target_col=target_col,
        model_path=model_path,
        metrics_path=metrics_path,
        filter_kwargs=filter_kwargs
    )
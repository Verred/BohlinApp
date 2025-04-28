import os
import pandas as pd
import numpy as np
import joblib
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
from django.conf import settings
from sqlalchemy import create_engine
import logging
import datetime

# Configurar logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Rutas
MODEL_PATH = os.path.join(settings.BASE_DIR, 'predictor', 'ml_model', 'modelo_random_forest_accidentes.pkl')
MODEL_METRICS_PATH = os.path.join(settings.BASE_DIR, 'predictor', 'ml_model', 'model_metrics.json')

# Columnas esperadas por el modelo (las mismas de ml_loader.py)
COLUMN_NAMES = [
    'HORA SINIESTRO', 'DISTRITO', 'ZONA', 'TIPO DE VÍA', 'RED VIAL',
    'EXISTE CICLOVÍA', 'CONDICIÓN CLIMÁTICA', 'ZONIFICACIÓN',
    'CARACTERÍSTICAS DE VÍA', 'PERFIL LONGITUDINAL VÍA', 'SUPERFICIE DE CALZADA',
    'senalizacion', 'DIA_DE_LA_SEMANA', 'MES', 'PERIODO_DEL_DIA', 'Feriado'
]

TARGET_COLUMN = 'ACCIDENTE'

def connect_to_database(connection_string):
    """Conecta a la base de datos y retorna el motor de conexión"""
    try:
        engine = create_engine(connection_string)
        logger.info("Conexión a la base de datos establecida")
        return engine
    except Exception as e:
        logger.error(f"Error al conectar a la base de datos: {e}")
        return None

def fetch_data(engine, query="SELECT * FROM accidentes"):
    """Obtiene los datos de la base de datos y los retorna como DataFrame"""
    try:
        df = pd.read_sql(query, engine)
        logger.info(f"Datos obtenidos exitosamente: {df.shape[0]} filas, {df.shape[1]} columnas")
        return df
    except Exception as e:
        logger.error(f"Error al obtener datos: {e}")
        return None

def clean_data(df):
    """Limpia y prepara los datos para el entrenamiento"""
    try:
        # Hacer una copia para no modificar el original
        df_clean = df.copy()
        
        # Verificar que todas las columnas necesarias estén presentes (convert column names)
        required_columns = COLUMN_NAMES + [TARGET_COLUMN]
        db_columns = [col.replace(' ', '_').upper() for col in required_columns]
        
        # Mapeo de nombres de columnas de la base de datos a los nombres esperados por el modelo
        column_mapping = {
            'HORA_SINIESTRO': 'HORA SINIESTRO',
            'TIPO_DE_VIA': 'TIPO DE VÍA',
            'EXISTE_CICLOVIA': 'EXISTE CICLOVÍA',
            'CONDICION_CLIMATICA': 'CONDICIÓN CLIMÁTICA',
            'CARACTERISTICAS_DE_VIA': 'CARACTERÍSTICAS DE VÍA',
            'PERFIL_LONGITUDINAL_VIA': 'PERFIL LONGITUDINAL VÍA',
            'SUPERFICIE_DE_CALZADA': 'SUPERFICIE DE CALZADA',
            'ZONIFICACION': 'ZONIFICACIÓN'
        }
        
        # Aplicar mapeo de nombres si es necesario
        df_clean = df_clean.rename(columns={col: column_mapping.get(col, col) for col in df_clean.columns})
        
        # Si aún faltan columnas, verificar si están en otro formato
        missing_cols = [col for col in required_columns if col not in df_clean.columns]
        if missing_cols:
            logger.warning(f"Columnas no encontradas en formato original: {missing_cols}")
            # Intenta buscar columnas con guiones bajos en lugar de espacios
            for col in missing_cols.copy():
                col_alt = col.replace(' ', '_')
                if col_alt in df_clean.columns:
                    df_clean = df_clean.rename(columns={col_alt: col})
                    missing_cols.remove(col)
            
            if missing_cols:
                logger.error(f"Faltan columnas en los datos después de renombrar: {missing_cols}")
                return None
        
        # Eliminar filas con valores nulos en las columnas importantes
        df_clean = df_clean.dropna(subset=COLUMN_NAMES + [TARGET_COLUMN])
        
        # Conversión de tipos de datos
        # Asegurar que las columnas numéricas sean int
        for col in COLUMN_NAMES:
            if df_clean[col].dtype == 'object':
                try:
                    df_clean[col] = df_clean[col].astype(float).astype(int)
                except:
                    # Si no se puede convertir, tratar como categórica
                    df_clean[col] = df_clean[col].astype('category').cat.codes
        
        # Asegurar que la variable objetivo sea int (0 o 1)
        df_clean[TARGET_COLUMN] = df_clean[TARGET_COLUMN].astype(int)
        
        # Código de limpieza adicional específico para tu dataset
        # -------------------------------------------------------
        # 1. Verificar y corregir valores fuera de rango
        # Hora debe estar entre 0 y 23
        df_clean.loc[df_clean['HORA SINIESTRO'] > 23, 'HORA SINIESTRO'] = 23
        df_clean.loc[df_clean['HORA SINIESTRO'] < 0, 'HORA SINIESTRO'] = 0
        
        # Día de la semana debe estar entre 0 y 6
        df_clean.loc[df_clean['DIA_DE_LA_SEMANA'] > 6, 'DIA_DE_LA_SEMANA'] = df_clean['DIA_DE_LA_SEMANA'] % 7
        
        # Mes debe estar entre 1 y 12
        df_clean.loc[df_clean['MES'] > 12, 'MES'] = 12
        df_clean.loc[df_clean['MES'] < 1, 'MES'] = 1
        
        # 2. Manejo de outliers con límites IQR para variables numéricas seleccionadas
        for col in ['CANTIDAD_DE_VEHICULOS_DAÑADOS'] if 'CANTIDAD_DE_VEHICULOS_DAÑADOS' in df_clean.columns else []:
            Q1 = df_clean[col].quantile(0.25)
            Q3 = df_clean[col].quantile(0.75)
            IQR = Q3 - Q1
            lower_bound = Q1 - 1.5 * IQR
            upper_bound = Q3 + 1.5 * IQR
            df_clean[col] = df_clean[col].clip(lower=lower_bound, upper=upper_bound)
        
        # 3. Verificación de balance de clases
        class_counts = df_clean[TARGET_COLUMN].value_counts()
        logger.info(f"Distribución de clases: {class_counts.to_dict()}")
        
        # Si hay desequilibrio extremo, puedes aplicar técnicas de balanceo aquí
        # Por ejemplo, subsampling de la clase mayoritaria o oversampling de la minoritaria
        
        logger.info(f"Datos limpios: {df_clean.shape[0]} filas después de limpieza")
        return df_clean
    
    except Exception as e:
        logger.error(f"Error durante la limpieza de datos: {e}")
        return None

def train_model(df_clean, test_size=0.2, random_state=42):
    """Entrena un modelo RandomForest con los datos limpios"""
    try:
        # Separar features y target
        X = df_clean[COLUMN_NAMES]
        y = df_clean[TARGET_COLUMN]
        
        # Verificar si hay clases desbalanceadas
        class_counts = y.value_counts()
        is_imbalanced = (class_counts.min() / class_counts.max()) < 0.25
        
        # Dividir en conjuntos de entrenamiento y prueba
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=random_state, stratify=y
        )
        
        # Configurar hiperparámetros del modelo
        if is_imbalanced:
            logger.info("Aplicando ajustes para clases desbalanceadas")
            # Para datos desbalanceados, usar class_weight
            model = RandomForestClassifier(
                n_estimators=200,
                max_depth=15,
                min_samples_split=5,
                min_samples_leaf=2,
                max_features='sqrt',
                bootstrap=True,
                class_weight='balanced',
                random_state=random_state,
                n_jobs=-1
            )
        else:
            model = RandomForestClassifier(
                n_estimators=100,
                max_depth=10,
                min_samples_split=5,
                min_samples_leaf=2,
                max_features='sqrt',
                bootstrap=True,
                random_state=random_state,
                n_jobs=-1
            )
        
        logger.info("Iniciando entrenamiento del modelo...")
        model.fit(X_train, y_train)
        
        # Evaluar el modelo
        y_pred = model.predict(X_test)
        
        # Predecir probabilidades para calcular curva ROC si el problema es binario
        roc_auc = None
        if len(np.unique(y)) == 2:
            from sklearn.metrics import roc_auc_score
            y_prob = model.predict_proba(X_test)[:, 1]
            roc_auc = float(roc_auc_score(y_test, y_prob))
        
        # Calcular métricas
        metrics = {
            'accuracy': float(accuracy_score(y_test, y_pred)),
            'precision': float(precision_score(y_test, y_pred, average='weighted')),
            'recall': float(recall_score(y_test, y_pred, average='weighted')),
            'f1_score': float(f1_score(y_test, y_pred, average='weighted')),
            'roc_auc': roc_auc,
            'test_size': test_size,
            'training_samples': X_train.shape[0],
            'test_samples': X_test.shape[0],
            'class_distribution': {str(k): int(v) for k, v in class_counts.items()},
            'feature_importances': dict(zip(COLUMN_NAMES, model.feature_importances_.tolist())),
            'training_date': datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }
        
        logger.info(f"Modelo entrenado. Accuracy: {metrics['accuracy']:.4f}")
        
        return model, metrics
    
    except Exception as e:
        logger.error(f"Error durante el entrenamiento del modelo: {e}")
        return None, None

def save_model(model, metrics):
    """Guarda el modelo entrenado y sus métricas"""
    try:
        # Crear directorio si no existe
        os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
        
        # Guardar el modelo
        joblib.dump(model, MODEL_PATH)
        
        # Guardar las métricas en formato JSON
        import json
        with open(MODEL_METRICS_PATH, 'w') as f:
            json.dump(metrics, f, indent=4)
        
        logger.info(f"Modelo guardado exitosamente en: {MODEL_PATH}")
        logger.info(f"Métricas guardadas en: {MODEL_METRICS_PATH}")
        
        return True
    
    except Exception as e:
        logger.error(f"Error al guardar el modelo: {e}")
        return False

def train_and_replace_model(connection_string, query=None):
    """Proceso completo: conectar, obtener datos, limpiar, entrenar y guardar modelo"""
    try:
        # Conectar a la base de datos
        engine = connect_to_database(connection_string)
        if engine is None:
            return {"status": "error", "message": "Error al conectar a la base de datos"}
        
        # Obtener datos
        if query:
            df = fetch_data(engine, query)
        else:
            df = fetch_data(engine)
            
        if df is None or df.empty:
            return {"status": "error", "message": "No se pudieron obtener datos o el conjunto está vacío"}
        
        # Limpiar datos
        df_clean = clean_data(df)
        if df_clean is None:
            return {"status": "error", "message": "Error en la limpieza de datos"}
        
        # Entrenar modelo
        model, metrics = train_model(df_clean)
        if model is None:
            return {"status": "error", "message": "Error en el entrenamiento del modelo"}
        
        # Guardar modelo
        success = save_model(model, metrics)
        if not success:
            return {"status": "error", "message": "Error al guardar el modelo"}
        
        # Cargar el nuevo modelo en memoria
        from .ml_loader import load_model
        load_model()
        
        return {
            "status": "success", 
            "message": "Modelo entrenado y actualizado correctamente", 
            "metrics": metrics
        }
    
    except Exception as e:
        logger.error(f"Error en el proceso de entrenamiento: {e}")
        return {"status": "error", "message": str(e)}
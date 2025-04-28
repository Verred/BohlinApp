import os
import joblib
from django.conf import settings
import pandas as pd
import numpy as np

# Variables globales
MODEL = None
COLUMN_NAMES = [
    'HORA SINIESTRO', 'DISTRITO', 'ZONA', 'TIPO DE VÍA', 'RED VIAL',
    'EXISTE CICLOVÍA', 'CONDICIÓN CLIMÁTICA', 'ZONIFICACIÓN',
    'CARACTERÍSTICAS DE VÍA', 'PERFIL LONGITUDINAL VÍA', 'SUPERFICIE DE CALZADA',
    'senalizacion', 'DIA_DE_LA_SEMANA', 'MES', 'PERIODO_DEL_DIA', 'Feriado'
]

def load_model():
    """Carga el modelo de machine learning"""
    global MODEL
    try:
        model_path = os.path.join(settings.BASE_DIR, 'predictor', 'ml_model', 'modelo_random_forest_accidentes.pkl')
        MODEL = joblib.load(model_path)
        print("Modelo cargado correctamente")
    except Exception as e:
        print(f"Error al cargar el modelo: {e}")
        MODEL = None

def get_model():
    """Retorna el modelo cargado o lo carga si no está disponible"""
    global MODEL
    if MODEL is None:
        load_model()
    return MODEL

def predict_single(values):
    """
    Realiza una predicción para una fila de valores
    
    Args:
        values: Lista con los valores en el orden correcto
        
    Returns:
        dict: Diccionario con la predicción y probabilidad
    """
    model = get_model()
    if model is None:
        return {"error": "Modelo no disponible", "status": "error"}
    
    try:
        # Verificar que el número de valores sea correcto
        if len(values) != len(COLUMN_NAMES):
            return {
                "error": f"Se esperan {len(COLUMN_NAMES)} valores",
                "received": len(values),
                "expected_columns": COLUMN_NAMES,
                "status": "error"
            }
        
        # Crear DataFrame y hacer predicción
        df = pd.DataFrame([values], columns=COLUMN_NAMES)
        prediction = int(model.predict(df)[0])
        probability = float(model.predict_proba(df)[0, 1])
        
        return {
            "prediction": prediction,
            "probability": probability,
            "is_accident": bool(prediction == 1),
            "status": "success"
        }
    except Exception as e:
        return {"error": str(e), "status": "error"}

def predict_batch(csv_file_path, output_path=None):
    """
    Realiza predicciones para un lote de datos desde un archivo CSV
    
    Args:
        csv_file_path: Ruta al archivo CSV con los datos
        output_path: Ruta para guardar el archivo CSV resultante
        
    Returns:
        str: Ruta al archivo CSV con los resultados
    """
    model = get_model()
    if model is None:
        return None
    
    try:
        # Cargar datos desde CSV
        df = pd.read_csv(csv_file_path)
        
        # Verificar que las columnas sean las esperadas
        missing_cols = [col for col in COLUMN_NAMES if col not in df.columns]
        if missing_cols:
            raise ValueError(f"Faltan columnas en el CSV: {missing_cols}")
        
        # Seleccionar solo las columnas necesarias en el orden correcto
        df_input = df[COLUMN_NAMES]
        
        # Hacer predicciones
        predictions = model.predict(df_input)
        probabilities = model.predict_proba(df_input)[:, 1]
        
        # Añadir predicciones al dataframe original
        df['prediccion'] = predictions
        df['probabilidad'] = probabilities
        df['es_accidente'] = df['prediccion'] == 1
        
        # Guardar resultados
        if output_path is None:
            output_path = csv_file_path.replace('.csv', '_resultados.csv')
        
        df.to_csv(output_path, index=False)
        return output_path
    
    except Exception as e:
        print(f"Error en la predicción por lotes: {e}")
        return None
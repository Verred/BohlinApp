import os
from django.conf import settings
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

# Configuraciones de base de datos
DB_CONFIGS = {
    'sqlite': {
        'connection_string': f'sqlite:///{os.path.join(settings.BASE_DIR, "data", "accidentes.db")}',
        'description': 'Base de datos SQLite local'
    },
    'mysql': {
        'connection_string': os.getenv('MYSQL_CONNECTION_STRING', 
                                     'mysql+pymysql://your_mysql_user:your_mysql_password@localhost:3306/accidents_db'),
        'description': 'Base de datos MySQL'
    },
    'postgres': {
        'connection_string': os.getenv('POSTGRES_CONNECTION_STRING', ''),
        'description': 'Base de datos PostgreSQL'
    }
}

def get_db_config(db_type='mysql'):
    """Obtiene la configuración de la base de datos seleccionada"""
    if db_type not in DB_CONFIGS:
        raise ValueError(f"Tipo de base de datos no soportado: {db_type}")
    
    return DB_CONFIGS[db_type]

def get_connection_string(db_type='mysql'):
    """Obtiene el string de conexión para la base de datos seleccionada"""
    config = get_db_config(db_type)
    return config['connection_string']
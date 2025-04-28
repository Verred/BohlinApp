import pandas as pd
import numpy as np
from sqlalchemy import create_engine
import os
import sys
from dotenv import load_dotenv

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Load environment variables
load_dotenv()

def import_csv_to_mysql(csv_file_path, connection_string=None):
    """Import CSV data to MySQL database"""
    try:
        # Use default connection string if none provided
        if connection_string is None:
            connection_string = os.getenv('MYSQL_CONNECTION_STRING', 
                                     'mysql+pymysql://your_mysql_user:your_mysql_password@localhost:3306/accidents_db')
        
        # Create SQLAlchemy engine
        engine = create_engine(connection_string)
        
        # Read CSV file
        print(f"Reading CSV file: {csv_file_path}")
        df = pd.read_csv(csv_file_path)
        
        # Rename columns to match MySQL table (replace spaces with underscores)
        df.columns = [col.replace(' ', '_') for col in df.columns]
        
        # Upload to MySQL
        print(f"Uploading {len(df)} rows to MySQL...")
        df.to_sql('accidentes', con=engine, if_exists='append', index=False)
        
        print("Data import completed successfully!")
        return True
    
    except Exception as e:
        print(f"Error importing data: {e}")
        return False

if __name__ == "__main__":
    # Check if CSV file path is provided as command line argument
    if len(sys.argv) > 1:
        csv_file_path = sys.argv[1]
    else:
        # Default path to CSV file
        csv_file_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 
                                    "data", "accidentes_sample.csv")
    
    import_csv_to_mysql(csv_file_path)
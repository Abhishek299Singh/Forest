import sqlite3
from app.core.config import settings

def run_migration():
    db_path = settings.IMAGES_DIR.parent / 'pench_offline.db'
    if not db_path.exists():
        print("Database does not exist yet; tables will be created by SQLAlchemy.")
        return

    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    columns_to_add = [
        ('tigers', 'dataset_source', "TEXT DEFAULT 'pench_field'"),
        ('tigers', 'is_reference', 'BOOLEAN DEFAULT 0'),
        ('tiger_images', 'dataset_source', "TEXT DEFAULT 'pench_field'"),
        ('tiger_images', 'original_image_path', 'TEXT'),
        ('tiger_embeddings', 'dataset_source', "TEXT DEFAULT 'pench_field'"),
    ]
    for table, col, col_type in columns_to_add:
        try:
            cursor.execute(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}")
            print(f"Added column {col} to {table}")
        except Exception as e:
            print(f"Note on {table}.{col}: {e}")
    conn.commit()
    conn.close()
    print("Migration completed.")

if __name__ == '__main__':
    run_migration()

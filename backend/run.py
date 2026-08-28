"""Dev entrypoint: python run.py"""

import os
import warnings
warnings.filterwarnings("ignore")

from app import create_app

app = create_app()

if __name__ == "__main__":
    app.run(
        host=os.getenv("HOST", "127.0.0.1"),
        port=int(os.getenv("PORT", "5000")),
        debug=os.getenv("FLASK_DEBUG", "").lower() in ("1", "true", "yes"),
        use_reloader=False,
    )

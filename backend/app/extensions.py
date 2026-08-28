"""Shared Flask extension instances (created here, bound to the app in the
factory) so every module imports the same objects without circular imports."""

from flask_cors import CORS
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()
migrate = Migrate()
cors = CORS()

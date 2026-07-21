# backend/app.py
from flask import Flask
from flask_cors import CORS
from database import init_db
from routes.tasks import tasks_bp
from routes.projects import projects_bp
from routes.activities import activities_bp
from routes.members import members_bp
from routes.needs import needs_bp
from routes.notes import notes_bp
from routes.performance import performance_bp
from routes.auth import auth_bp
from routes.difficulties import difficulties_bp
from routes.daily_order import daily_order_bp
from routes.reports import reports_bp
from routes.notifications import notifications_bp

app = Flask(__name__)
CORS(app)

# ── Blueprints v1 (inchangés) ──────────────────────────────────────────────
app.register_blueprint(tasks_bp,       url_prefix="/api/tasks")
app.register_blueprint(projects_bp,    url_prefix="/api/projects")
app.register_blueprint(activities_bp,  url_prefix="/api/activities")
app.register_blueprint(members_bp,     url_prefix="/api/members")
app.register_blueprint(needs_bp,       url_prefix="/api/needs")
app.register_blueprint(notes_bp,       url_prefix="/api/notes")
app.register_blueprint(performance_bp, url_prefix="/api/performance")

# ── Blueprints v2 Bloc 1 ───────────────────────────────────────────────────
app.register_blueprint(auth_bp,        url_prefix="/api/auth")
app.register_blueprint(difficulties_bp,url_prefix="/api/difficulties")

# ── Blueprints v2 Bloc 2 ───────────────────────────────────────────────────
app.register_blueprint(daily_order_bp, url_prefix="/api/daily-order")
app.register_blueprint(reports_bp,     url_prefix="/api/reports")
app.register_blueprint(notifications_bp, url_prefix="/api/notifications")

if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", port=5000, debug=True)
"""Request/response validation schemas. Every endpoint validates through one
of these before any ML or persistence code runs."""

from marshmallow import EXCLUDE, RAISE, Schema, fields, validate

# Observed categories in the German Credit training data. Unknown values are
# rejected here rather than silently zeroing out inside the OneHotEncoder.
JOB_CATEGORIES = [
    "unemp/unskilled non res",
    "unskilled resident",
    "skilled",
    "high qualif/self emp/mgmt",
]


class ApplicantSchema(Schema):
    class Meta:
        unknown = EXCLUDE

    age = fields.Integer(required=True, validate=validate.Range(min=18, max=120))
    job = fields.String(required=True, validate=validate.OneOf(JOB_CATEGORIES))
    credit_amount = fields.Float(
        required=True, validate=validate.Range(min=1, max=10_000_000)
    )
    duration = fields.Integer(
        required=True, validate=validate.Range(min=1, max=600),
        metadata={"description": "Loan duration in months"},
    )
    existing_credits = fields.Integer(
        required=True, validate=validate.Range(min=1, max=10)
    )

    checking_status = fields.String()
    credit_history = fields.String()
    purpose = fields.String()
    savings_status = fields.String()
    employment = fields.String()
    installment_commitment = fields.Integer()
    personal_status = fields.String()
    other_parties = fields.String()
    residence_since = fields.Integer()
    property_magnitude = fields.String()
    other_payment_plans = fields.String()
    housing = fields.String()
    own_telephone = fields.String()
    foreign_worker = fields.String()
    num_dependents = fields.Integer()


class BatchPredictSchema(Schema):
    """Validate a list of applicant payloads for batch scoring. Rows that
    fail validation are collected per-index (with a row key) so one bad row
    never aborts the whole batch."""

    class Meta:
        unknown = EXCLUDE

    applicants = fields.List(fields.Dict(), required=True)


class ScenarioSchema(Schema):
    """Both sides of a what-if comparison must be complete applicants so the
    prediction service can score them identically."""

    class Meta:
        unknown = RAISE

    original = fields.Nested(ApplicantSchema, required=True)
    modified = fields.Nested(ApplicantSchema, required=True)


class HistoryQuerySchema(Schema):
    class Meta:
        unknown = RAISE

    page = fields.Integer(load_default=1, validate=validate.Range(min=1))
    # None -> the route substitutes HISTORY_DEFAULT_PER_PAGE from config.
    per_page = fields.Integer(load_default=None, validate=validate.Range(min=1))

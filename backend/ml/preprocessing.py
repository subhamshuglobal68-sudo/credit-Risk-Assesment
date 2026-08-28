"""Single source of truth for feature preparation.

Training fits the ColumnTransformer here and pickles the FITTED object;
inference loads that same pickle. There is deliberately no second copy of
preprocessing logic in the app - this module is imported only by ml/train.py,
and the fitted transformer travels via preprocessor.pkl. That makes feature
drift between train and serve structurally impossible.
"""

import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


def split_feature_types(df: pd.DataFrame, feature_columns) -> tuple[list, list]:
    numeric = [c for c in feature_columns if pd.api.types.is_numeric_dtype(df[c])]
    categorical = [c for c in feature_columns if c not in numeric]
    return numeric, categorical


def build_preprocessor(df: pd.DataFrame, feature_columns) -> tuple[ColumnTransformer, list, list]:
    """Returns an UNFITTED preprocessor + the column splits (which get frozen
    into metadata.json so inference can rebuild identical input frames)."""
    numeric_cols, categorical_cols = split_feature_types(df, feature_columns)

    numeric_pipeline = Pipeline(steps=[
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler()),
    ])
    categorical_pipeline = Pipeline(steps=[
        ("imputer", SimpleImputer(strategy="most_frequent")),
        ("onehot", OneHotEncoder(handle_unknown="ignore")),
    ])

    preprocessor = ColumnTransformer(transformers=[
        ("num", numeric_pipeline, numeric_cols),
        ("cat", categorical_pipeline, categorical_cols),
    ])
    return preprocessor, numeric_cols, categorical_cols

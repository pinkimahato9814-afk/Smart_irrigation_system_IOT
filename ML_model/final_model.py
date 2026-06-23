from pathlib import Path
import pickle

import pandas as pd
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.model_selection import train_test_split
from sklearn.tree import DecisionTreeClassifier, export_text


BASE_DIR = Path(__file__).resolve().parent
CSV_PATH = BASE_DIR / "moisture_readings.csv"
MODEL_PATH = BASE_DIR / "moisture_status_model.pkl"
PREDICTIONS_PATH = BASE_DIR / "model_predictions.csv"


def main() -> None:
    df = pd.read_csv(CSV_PATH)

    # `raw` is the real sensor measurement.
    # `status` is the class label produced by the moisture logic.
    X = df[["raw"]]
    y = df["status"]

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42,
        stratify=y,
    )

    # A shallow tree is enough here because the classes are separated by thresholds.
    model = DecisionTreeClassifier(max_depth=3, random_state=42)
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)

    print("Selected feature column :", list(X.columns))
    print("Selected target column  :", "status")
    print()
    print("Why other columns are not used:")
    print("- pump_on: derived from status, so it leaks the answer")
    print("- time_valid: always True, so it adds no learning value")
    print("- reading_id / ts_epoch / ts_iso / ts_ms: identifiers or timestamps, not moisture features")
    print()
    print(f"Train size: {len(X_train)}")
    print(f"Test size : {len(X_test)}")
    print(f"Accuracy  : {accuracy:.4f}")
    print()
    print("Classification report:")
    print(classification_report(y_test, y_pred))
    print("Confusion matrix:")
    print(confusion_matrix(y_test, y_pred))
    print()
    print("Learned decision rules:")
    print(export_text(model, feature_names=["raw"]))

    results = X_test.copy()
    results["actual_status"] = y_test.values
    results["predicted_status"] = y_pred
    results["predicted_pump_on"] = results["predicted_status"].eq("RED")
    results.to_csv(PREDICTIONS_PATH, index=False)

    with MODEL_PATH.open("wb") as model_file:
        pickle.dump(model, model_file)

    print(f"Saved model to: {MODEL_PATH}")
    print(f"Saved predictions to: {PREDICTIONS_PATH}")


if __name__ == "__main__":
    main()

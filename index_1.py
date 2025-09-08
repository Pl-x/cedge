import os
import json
# import sys
import pandas as pd
from sklearn.tree import DecisionTreeClassifier as dtc
from sklearn.model_selction import train_test_split as tts
from sklearn.metrics import accuracy_score as how_accurate

def trainer_model():
  grouped_data = pd.read_csv('scores.csv')
  # grouped_data
  X = grouped_data.drop(columns=['outcome'])
  y = grouped_data['outcome']
  X_train, X_test, y_train, y_test = tts(X, y, test_size=0.2)

  model = dtc()
  model.fit(X_train, y_train)
  variables = pd.DataFrame({'Team A': ['Manchester City'], 'Team B': ['Manchester United']})
  prediction = model.predict(variables)
  accuracy_level = how_accurate(y_test, prediction)
  return prediction,accuracy_level


def main():
  '''main'''
  try:
    if os.path.exists('outcome.json'):
      with open('outcome.json', 'w') as file:
        # file.read()
        json.dump(prediction, file)
        json.dump(accuracy_level, file)
    else:
      RaiseException(f'Error: {'PathNotExists'} File: {file}')
  except FileNotFoundError as e:
     print(e)
  finally:
     with open('outcome.json', 'r') as file_appended:
       file_appended.read()


if __name__ == "__main__":
  trainer_model()
  main()

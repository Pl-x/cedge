import os
import json
# import sys
import pandas as pd
from scikit.tree import DecisionTreeClassifier as dtc

def trainer_model():
  grouped_data = pd.read_csv('scores.csv')
  # grouped_data
  X = grouped_data.drop('outcome')
  y = grouped_data['outcome']

  model = dtc()
  model.fit(X, y)
  variables = pd.DataFrame({'Team A': ['Manchester City'], 'Team B': ['Manchester United']})
  prediction = model.predict(variables)
  return prediction


def main():
  '''main'''
  try:
    if os.path.exists('outcome.json'):
      with open('outcome.json', 'w') as file:
        # file.read()
        json.dump(prediction, file')
    else:
      RaiseException(f'Error: {PathNotExists} File: {file}')
  except FileNotFoundError as e:
     print(e)
  finally:
     with open('outcome.json', 'r') as file_appended:
       file_appended.read()


if __name__ == "__main__":
  trainer_model()
  main()

import sys
sys.path.insert(0, "backend")

import utils.aqi_calculator as a

print("Loaded:", a.__file__)
print("compute_aqi exists:", hasattr(a, "compute_aqi"))
print(dir(a))
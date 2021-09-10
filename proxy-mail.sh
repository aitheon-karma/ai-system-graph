#!/bin/bash

kubectl port-forward svc/ai-mail 2525:25 --namespace=ai-mail
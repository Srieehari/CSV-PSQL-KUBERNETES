How to run this project:

docker build -t your-dockerhub-username/kube-rviz:latest

docker push your-dockerhub-username/kube-rviz:latest

kubectl apply -f k8s/postgres.yaml

kubectl apply -f k8s/express-api.yaml

kubectl port-forward svc/kube-rviz-api-svc 8000:8000

Open the html file at http://localhost:8000 

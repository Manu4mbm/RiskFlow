from django.urls import path

from . import views

app_name = 'scheduler'

urlpatterns = [
    path('', views.index, name='index'),
    path('privacy/', views.privacy, name='privacy'),
    path('sw.js', views.service_worker, name='service-worker'),
]

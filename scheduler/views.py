from django.contrib.staticfiles import finders
from django.http import FileResponse, Http404
from django.shortcuts import render


def index(request):
    return render(request, 'scheduler/index.html')


def service_worker(request):
    """Served at /sw.js (not /static/...) so its default scope covers the whole app."""
    path = finders.find('scheduler/js/sw.js')
    if not path:
        raise Http404
    response = FileResponse(open(path, 'rb'), content_type='application/javascript')
    response['Cache-Control'] = 'no-cache'
    response['Service-Worker-Allowed'] = '/'
    return response

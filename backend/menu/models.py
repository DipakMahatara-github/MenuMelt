from django.db import models

class MenuItem(models.Model):
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    price = models.DecimalField(max_digits=8, decimal_places=2)
    category = models.CharField(max_length=100)
    available = models.BooleanField(default=True)
    image = models.URLField(blank=True)

    def __str__(self):
        return self.name

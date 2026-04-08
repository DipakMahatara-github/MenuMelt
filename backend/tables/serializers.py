from rest_framework import serializers
from .models import Table

class TableSerializer(serializers.ModelSerializer):
    class Meta:
        model = Table
        fields = ['id', 'number', 'qr_code', 'qr_image']
        read_only_fields = ['qr_code', 'qr_image']
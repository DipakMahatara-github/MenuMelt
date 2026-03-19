from rest_framework import serializers
from .models import Table

class TableSerializer(serializers.ModelSerializer):
    qr_code = serializers.SerializerMethodField()

    class Meta:
        model = Table
        fields = ['id', 'number', 'qr_code']

    def get_qr_code(self, obj):
        request = self.context.get('request')
        if obj.qr_code:
            return request.build_absolute_uri(obj.qr_code.url)
        return None
from django.db import models

class Table(models.Model):
    number = models.IntegerField(unique=True)
    qr_code = models.ImageField(upload_to='qr_codes/', blank=True, null=True)

    def __str__(self):
        return f"Table {self.number}"

    def save(self, *args, **kwargs):
        is_new = self.pk is None   

        super().save(*args, **kwargs)  

        if is_new and not self.qr_code:
            from .utils import generate_qr_code
            generate_qr_code(self)

            super().save(update_fields=['qr_code'])  
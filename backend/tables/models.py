from django.db import models
from django.core.files.base import ContentFile
import qrcode
import uuid
from io import BytesIO

from .utils import table_menu_qr_url


class Table(models.Model):

    restaurant = models.ForeignKey(
        "restaurants.Restaurant",
        on_delete=models.CASCADE,
        related_name="tables"
    )

    number = models.IntegerField()

    # 🔥 ADD THIS
    qr_code = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    qr_image = models.ImageField(upload_to="qr_codes/", null=True, blank=True)

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)

        # Generate QR only when table is first created.
        if is_new and not self.qr_image:
            qr_url = table_menu_qr_url(self)
            qr_img = qrcode.make(qr_url)

            buffer = BytesIO()
            qr_img.save(buffer, format="PNG")
            buffer.seek(0)

            self.qr_image.save(
                f"table-{self.id}.png",
                ContentFile(buffer.getvalue()),
                save=True,
            )

    class Meta:
        unique_together = ("restaurant", "number")

    def __str__(self):
        return f"{self.restaurant.name} - Table {self.number}"
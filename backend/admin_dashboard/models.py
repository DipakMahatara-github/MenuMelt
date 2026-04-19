from django.db import models


class PlatformSettings(models.Model):
    """
    Singleton-style platform settings row used by platform admin pages.
    """

    allow_restaurant_registration = models.BooleanField(default=False)
    khalti_public_key = models.CharField(max_length=255, blank=True, default="")
    khalti_secret_key = models.CharField(max_length=255, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Platform settings"
        verbose_name_plural = "Platform settings"

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return "Platform settings"

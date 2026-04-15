from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import User
from orders.models import Order, OrderReview
from restaurants.models import Restaurant
from tables.models import Table


class DashboardReviewAnalyticsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin_user = User.objects.create_user(
            email="dashboard@example.com",
            password="password123",
            full_name="Dashboard Owner",
            role="restaurant_admin",
        )
        self.restaurant = Restaurant.objects.create(
            owner=self.admin_user,
            name="Review House",
            address="Pokhara",
        )
        self.admin_user.restaurant = self.restaurant
        self.admin_user.save(update_fields=["restaurant"])

        self.table = Table.objects.create(restaurant=self.restaurant, number=2)
        self.order = Order.objects.create(
            restaurant=self.restaurant,
            table=self.table,
            session_id="session-analytics",
            customer_name="Sushmita",
            subtotal_price="1200.00",
            discount_total="0.00",
            total_price="1200.00",
            status=Order.STATUS_SERVED,
            billing_status=Order.BILLING_ST_PAID,
            payment_status=Order.PAYMENT_ST_PAID,
        )
        OrderReview.objects.create(
            order=self.order,
            restaurant=self.restaurant,
            session_id="session-analytics",
            customer_name="Sushmita",
            food_quality=4,
            service=5,
            overall_experience=5,
            comment="Loved the momo and fast service.",
        )

    def test_dashboard_returns_review_summary_and_recent_feedback(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get("/api/dashboard/")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["reviews"]["count"], 1)
        self.assertEqual(payload["reviews"]["recent"][0]["comment"], "Loved the momo and fast service.")

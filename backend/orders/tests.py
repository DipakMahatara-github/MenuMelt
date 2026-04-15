from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import User
from orders.models import Order, OrderReview
from restaurants.models import Restaurant
from tables.models import Table


class OrderReviewSubmissionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin_user = User.objects.create_user(
            email="reviews@example.com",
            password="password123",
            full_name="Review Owner",
            role="restaurant_admin",
        )
        self.restaurant = Restaurant.objects.create(
            owner=self.admin_user,
            name="Feedback Kitchen",
            address="Lalitpur",
        )
        self.admin_user.restaurant = self.restaurant
        self.admin_user.save(update_fields=["restaurant"])

        self.table = Table.objects.create(restaurant=self.restaurant, number=7)
        self.order = Order.objects.create(
            restaurant=self.restaurant,
            table=self.table,
            session_id="session-review",
            customer_name="Guest",
            subtotal_price="800.00",
            discount_total="0.00",
            total_price="800.00",
            status=Order.STATUS_SERVED,
        )

    def test_customer_can_submit_review_for_served_order(self):
        response = self.client.post(
            f"/api/orders/{self.order.id}/review/",
            {
                "food_quality": 4,
                "service": 5,
                "overall_experience": 5,
                "comment": "Everything came out hot and fresh.",
            },
            format="json",
            HTTP_X_TABLE_TOKEN=str(self.table.qr_code),
            HTTP_X_SESSION_ID="session-review",
        )

        self.assertEqual(response.status_code, 201)
        self.assertTrue(OrderReview.objects.filter(order=self.order).exists())
        self.assertEqual(response.json()["review"]["overall_experience"], 5)

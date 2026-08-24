from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from authentification.models import StatutCompte, User

from .models import Notification
from .services import notify


def make_user(username):
    return User.objects.create(username=username, statut=StatutCompte.ACTIF, is_active=True)


class NotifyServiceTests(TestCase):
    def test_pas_d_auto_notification(self):
        g = make_user("gabriel")
        notif = notify(g, "test.verbe", "titre", expediteur=g)
        self.assertIsNone(notif)
        self.assertEqual(Notification.objects.count(), 0)

    def test_notifie_le_destinataire(self):
        g, d = make_user("gabriel"), make_user("darelle")
        notify(d, "test.verbe", "titre", expediteur=g)
        self.assertEqual(d.notifications.count(), 1)
        self.assertEqual(g.notifications.count(), 0)


class NotificationApiTests(TestCase):
    def setUp(self):
        self.user = make_user("darelle")
        self.autre = make_user("gabriel")
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_purge_automatique_apres_7_jours(self):
        vieille = notify(self.user, "v", "vieille", expediteur=self.autre)
        Notification.objects.filter(pk=vieille.pk).update(cree_le=timezone.now() - timedelta(days=8))
        notify(self.user, "v", "recente", expediteur=self.autre)
        r = self.client.get("/api/notifications")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data), 1)
        self.assertEqual(r.data[0]["titre"], "recente")

    def test_marquer_lu_et_tout_lu(self):
        n1 = notify(self.user, "v", "n1", expediteur=self.autre)
        notify(self.user, "v", "n2", expediteur=self.autre)
        r = self.client.patch(f"/api/notifications/{n1.pk}/read")
        self.assertEqual(r.status_code, 200)
        n1.refresh_from_db()
        self.assertIsNotNone(n1.lu_le)
        r2 = self.client.patch("/api/notifications/read-all")
        self.assertEqual(r2.status_code, 200)
        self.assertEqual(self.user.notifications.filter(lu_le__isnull=True).count(), 0)

    def test_ne_peut_pas_lire_la_notif_dun_autre(self):
        autre_user = make_user("stevenie")
        n = notify(autre_user, "v", "privee", expediteur=self.autre)
        r = self.client.patch(f"/api/notifications/{n.pk}/read")
        self.assertEqual(r.status_code, 404)

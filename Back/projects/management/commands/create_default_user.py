from django.core.management.base import BaseCommand
from django.contrib.auth.models import User

class Command(BaseCommand):
    help = 'Crea un usuario por defecto para la aplicación'

    def add_arguments(self, parser):
        parser.add_argument(
            '--username',
            type=str,
            default='admin',
            help='Username del usuario (default: admin)'
        )
        parser.add_argument(
            '--password',
            type=str,
            default='defaultpass123',
            help='Contraseña del usuario (default: defaultpass123)'
        )
        parser.add_argument(
            '--email',
            type=str,
            default='admin@example.com',
            help='Email del usuario (default: admin@example.com)'
        )

    def handle(self, *args, **options):
        username = options['username']
        password = options['password']
        email = options['email']
        
        if User.objects.filter(username=username).exists():
            self.stdout.write(
                self.style.WARNING(f'El usuario "{username}" ya existe.')
            )
            return
        
        try:
            user = User.objects.create_user(
                username=username,
                password=password,
                email=email,
                is_staff=True,
                is_superuser=True
            )
            self.stdout.write(
                self.style.SUCCESS(f'Usuario "{username}" creado exitosamente.')
            )
            self.stdout.write(f'Username: {username}')
            self.stdout.write(f'Password: {password}')
            self.stdout.write(f'Email: {email}')
            self.stdout.write(
                self.style.WARNING('¡IMPORTANTE! Cambie la contraseña después del primer login.')
            )
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Error al crear el usuario: {str(e)}')
            )
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, Tag, TagLog

# Register your models here.
admin.site.register(User, UserAdmin)
admin.site.register(Tag)

@admin.register(TagLog)
class TagLogAdmin(admin.ModelAdmin):
    list_display = ('tag', 'value', 'timestamp')
    list_filter = ('tag', 'timestamp')
    ordering = ('-timestamp',)

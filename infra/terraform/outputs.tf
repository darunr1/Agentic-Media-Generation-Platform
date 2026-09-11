output "web_url" { value = google_cloud_run_v2_service.web.uri }
output "media_bucket" { value = google_storage_bucket.media.name }
output "artifact_repository" { value = google_artifact_registry_repository.app.name }

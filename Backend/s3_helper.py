"""
s3_helper.py
------------
All interaction with AWS S3 lives here.
Boto3 is configured from environment variables so no credentials
are ever hardcoded.
"""

import os
import uuid
import logging
import boto3
from botocore.exceptions import ClientError
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────

S3_BUCKET: str   = os.environ["S3_BUCKET"]          # skincancer-data-kce
AWS_REGION: str  = os.environ["AWS_REGION"]          # ap-southeast-2

# boto3 automatically picks up AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY
# from the environment, so we do not pass them explicitly here.
_s3_client = boto3.client("s3", region_name=AWS_REGION)


# ── Public helpers ────────────────────────────────────────────────────────────

def upload_image_to_s3(file_bytes: bytes, original_filename: str, content_type: str) -> dict:
    """
    Upload raw image bytes to S3.

    Returns a dict:
        {
            "s3_key":    "scans/<uuid>.<ext>",
            "image_url": "https://<bucket>.s3.<region>.amazonaws.com/scans/<uuid>.<ext>"
        }

    Raises RuntimeError on failure so the caller can return a 500 cleanly.
    """
    # Build a collision-free S3 key
    ext     = _safe_extension(original_filename)
    s3_key  = f"scans/{uuid.uuid4().hex}{ext}"

    try:
        _s3_client.put_object(
            Bucket=S3_BUCKET,
            Key=s3_key,
            Body=file_bytes,
            ContentType=content_type,
            # Remove ACL='public-read' if your bucket blocks public ACLs.
            # Use a pre-signed URL approach instead (see get_presigned_url below).
        )
    except ClientError as exc:
        logger.error("S3 upload failed: %s", exc)
        raise RuntimeError(f"S3 upload failed: {exc}") from exc

    image_url = (
        f"https://{S3_BUCKET}.s3.{AWS_REGION}.amazonaws.com/{s3_key}"
    )
    logger.info("Uploaded to S3: %s", s3_key)
    return {"s3_key": s3_key, "image_url": image_url}


def get_presigned_url(s3_key: str, expiry_seconds: int = 3600) -> str:
    """
    Generate a temporary pre-signed URL for private S3 objects.
    Useful if the bucket does NOT have public-read ACLs.
    """
    try:
        url = _s3_client.generate_presigned_url(
            "get_object",
            Params={"Bucket": S3_BUCKET, "Key": s3_key},
            ExpiresIn=expiry_seconds,
        )
        return url
    except ClientError as exc:
        logger.error("Presigned URL generation failed: %s", exc)
        raise RuntimeError(f"Presigned URL error: {exc}") from exc


def delete_from_s3(s3_key: str) -> None:
    """Delete an object from S3. Used when a scan record is removed."""
    try:
        _s3_client.delete_object(Bucket=S3_BUCKET, Key=s3_key)
        logger.info("Deleted from S3: %s", s3_key)
    except ClientError as exc:
        logger.warning("S3 delete failed (non-fatal): %s", exc)


# ── Private helpers ───────────────────────────────────────────────────────────

def _safe_extension(filename: str) -> str:
    """Extract and whitelist the file extension; default to .jpg."""
    allowed = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
    _, ext = os.path.splitext(filename.lower())
    return ext if ext in allowed else ".jpg"
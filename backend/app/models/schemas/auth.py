from datetime import datetime
from typing import List, Literal, Optional
from pydantic import BaseModel, Field

UserRole = Literal["inquilino", "propietario", "administrador"]
RecoveryMethod = Literal["questions", "recovery_code"]


class SecurityQuestionItem(BaseModel):
    question: str = Field(..., min_length=5, max_length=255)
    answer: str = Field(..., min_length=2, max_length=120)


class RegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=120, description="Nombre completo del usuario")
    email: str = Field(..., min_length=5, max_length=255, description="Correo electrónico")
    password: str = Field(..., min_length=8, max_length=72, description="Contraseña (mín. 8 caracteres)")
    role: UserRole = Field("inquilino", description="Perfil: inquilino | propietario | administrador")
    security_questions: List[SecurityQuestionItem] = Field(
        ...,
        min_length=3,
        max_length=3,
        description="Exactamente 3 preguntas de seguridad distintas para recuperación segura sin pagos",
    )
    accepted_privacy_policy: bool = Field(
        True,
        description="Autorización previa, expresa e informada de la Política de Tratamiento de Datos (Ley 1581 de 2012)",
    )


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=255)
    password: str = Field(..., min_length=1, max_length=72)


class UserProfile(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    security_questions_count: int = 3
    has_recovery_code: bool = True
    privacy_policy_version: Optional[str] = None
    privacy_policy_accepted_at: Optional[datetime] = None
    created_at: datetime
    documents_count: int = 0
    conversations_count: int = 0


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserProfile
    recovery_code: Optional[str] = Field(
        None,
        description="Código maestro de recuperación (se muestra una sola vez al crear la cuenta)",
    )


class RecoveryQuestionRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=255)


class RecoveryQuestionResponse(BaseModel):
    email: str
    security_questions: List[str]
    supports_recovery_code: bool = True
    message: str


class ResetPasswordRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=255)
    method: RecoveryMethod = Field("questions", description="'questions' (3 respuestas) o 'recovery_code'")
    security_answers: Optional[List[str]] = Field(
        None,
        description="Lista ordenada con las 3 respuestas a las preguntas de seguridad",
    )
    recovery_code: Optional[str] = Field(
        None,
        description="Código maestro de respaldo (formato LP-XXXX-XXXX)",
    )
    new_password: str = Field(..., min_length=8, max_length=72)


class ResetPasswordResponse(BaseModel):
    status: str = "success"
    message: str
    new_recovery_code: Optional[str] = Field(
        None,
        description="Nuevo código de respaldo rotado automáticamente si se utilizó el código anterior",
    )


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1, max_length=72)
    new_password: str = Field(..., min_length=8, max_length=72)


class SecurityLogItem(BaseModel):
    id: str
    action: str
    status: str
    ip_hash: Optional[str] = None
    details: Optional[str] = None
    created_at: datetime


class GenericMessageResponse(BaseModel):
    status: str = "success"
    message: str

from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field

UserRole = Literal["inquilino", "propietario", "administrador"]


class RegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=120, description="Nombre completo del usuario")
    email: str = Field(..., min_length=5, max_length=255, description="Correo electrónico")
    password: str = Field(..., min_length=6, max_length=72, description="Contraseña (mín. 6 caracteres)")
    role: UserRole = Field("inquilino", description="Perfil: inquilino | propietario | administrador")
    security_question: str = Field(
        ...,
        min_length=5,
        max_length=255,
        description="Pregunta de seguridad para recuperación gratuita de contraseña",
    )
    security_answer: str = Field(
        ...,
        min_length=2,
        max_length=120,
        description="Respuesta secreta a la pregunta de seguridad",
    )


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=255)
    password: str = Field(..., min_length=1, max_length=72)


class UserProfile(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    has_security_question: bool = True
    created_at: datetime
    documents_count: int = 0
    conversations_count: int = 0


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserProfile


class RecoveryQuestionRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=255)


class RecoveryQuestionResponse(BaseModel):
    email: str
    security_question: str
    message: str


class ResetPasswordRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=255)
    security_answer: str = Field(..., min_length=1, max_length=120)
    new_password: str = Field(..., min_length=6, max_length=72)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1, max_length=72)
    new_password: str = Field(..., min_length=6, max_length=72)


class GenericMessageResponse(BaseModel):
    status: str = "success"
    message: str

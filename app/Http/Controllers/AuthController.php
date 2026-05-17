<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $request->validate([
            'email'    => 'required|email',
            'password' => 'required|string',
        ]);

        $user = User::where('email', $request->email)->first();

        if (!$user) {
            return response()->json(['message' => 'Identifiants incorrects'], 401);
        }

        // Try multiple hash algorithms
        $password = $request->password;
        $valid = false;

        if (Hash::check($password, $user->password)) {
            $valid = true;
        } elseif (password_verify($password, $user->password)) {
            $valid = true;
        } elseif (Auth::attempt(['email' => $request->email, 'password' => $password])) {
            $valid = true;
        }

        if (!$valid) {
            return response()->json(['message' => 'Identifiants incorrects'], 401);
        }

        $user->tokens()->delete();
        $token = $user->createToken('admin-token')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user'  => [
                'id'    => $user->id,
                'name'  => $user->name,
                'email' => $user->email,
            ]
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['message' => 'Déconnecté']);
    }

    public function me(Request $request)
    {
        return response()->json($request->user());
    }
}
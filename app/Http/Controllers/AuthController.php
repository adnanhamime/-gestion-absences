<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $email = $request->input('email');
        $password = $request->input('password');

        if ($email === 'admin@ofppt.ma' && $password === 'admin1234') {
            $user = User::where('email', $email)->first();
            if (!$user) {
                $user = User::create([
                    'name' => 'Admin',
                    'email' => 'admin@ofppt.ma',
                    'password' => 'admin1234',
                ]);
            }
            $user->tokens()->delete();
            $token = $user->createToken('admin-token')->plainTextToken;
            return response()->json([
                'token' => $token,
                'user'  => ['id' => $user->id, 'name' => $user->name, 'email' => $user->email]
            ]);
        }

        return response()->json(['message' => 'Identifiants incorrects'], 401);
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

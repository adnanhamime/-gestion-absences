<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Crée l'admin si pas déjà existant
        User::firstOrCreate(
            ['email' => 'admin@ofppt.ma'],
            [
                'name'     => 'Admin',
                'email'    => 'admin@ofppt.ma',
                'password' => Hash::make('admin1234'),
            ]
        );
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Absence extends Model
{
    use HasFactory;

    protected $fillable = [
        'student_id',
        'absence_date',
        'session_name',
        'reason',
        'status'
    ];

    public function student()
    {
        return $this->belongsTo(Student::class);
    }
}
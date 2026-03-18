package com.example.bipolnavbar

import android.os.Bundle
import androidx.fragment.app.Fragment
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.example.bipolnavbar.databinding.FragmentAnnouncementBinding
import com.example.bipolnavbar.databinding.ItemAnnouncementBinding
import com.google.gson.annotations.SerializedName
import kotlinx.coroutines.launch
import retrofit2.Response
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.GET
import okhttp3.OkHttpClient
import okhttp3.Request

class Announcement : Fragment() {

    private var _binding: FragmentAnnouncementBinding? = null
    // Menggunakan safe call untuk menghindari NullPointerException saat fragment sudah dihancurkan
    private val binding get() = _binding
    
    private lateinit var announcementService: AnnouncementService
    private lateinit var adapter: AnnouncementAdapter

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentAnnouncementBinding.inflate(inflater, container, false)
        return _binding!!.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        setupRecyclerView()
        announcementService = AnnouncementService.create()

        fetchAnnouncements()
    }

    private fun setupRecyclerView() {
        adapter = AnnouncementAdapter()
        binding?.recyclerView?.apply {
            layoutManager = LinearLayoutManager(requireContext())
            adapter = this@Announcement.adapter
        }
    }

    private fun fetchAnnouncements() {
        lifecycleScope.launch {
            try {
                // Gunakan safe call pada binding
                binding?.apply {
                    shimmerView.visibility = View.VISIBLE
                    shimmerView.startShimmer()
                    recyclerView.visibility = View.GONE
                }

                val response = announcementService.getAnnouncements()

                if (response.isSuccessful) {
                    val announcements = response.body()?.data ?: emptyList()
                    adapter.submitList(announcements)
                    
                    binding?.apply {
                        shimmerView.stopShimmer()
                        shimmerView.visibility = View.GONE
                        recyclerView.visibility = View.VISIBLE
                    }
                } else {
                    if (isAdded) {
                        Toast.makeText(requireContext(), "Gagal mengambil data", Toast.LENGTH_SHORT).show()
                    }
                }
            } catch (e: Exception) {
                // Log error if needed
            } finally {
                binding?.apply {
                    shimmerView.stopShimmer()
                    shimmerView.visibility = View.GONE
                }
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}

data class AnnouncementItem(
    @SerializedName("created_by") val createdBy: String,
    val id: Int,
    val message: String,
    val time: String
)

class AnnouncementAdapter : androidx.recyclerview.widget.RecyclerView.Adapter<AnnouncementAdapter.ViewHolder>() {

    private var data: List<AnnouncementItem> = emptyList()

    fun submitList(newList: List<AnnouncementItem>) {
        data = newList
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemAnnouncementBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(data[position])
    }

    override fun getItemCount(): Int = data.size

    class ViewHolder(private val binding: ItemAnnouncementBinding) : androidx.recyclerview.widget.RecyclerView.ViewHolder(binding.root) {
        fun bind(item: AnnouncementItem) {
            binding.createdByTextView.text = "Posted by: ${item.createdBy}"
            binding.messageTextView.text = item.message
            binding.timeTextView.text = item.time
        }
    }
}

data class AnnouncementResponse(
    val data: List<AnnouncementItem>,
    val message: String,
    val statusCode: Int
)

interface AnnouncementService {

    @GET("announcement")
    suspend fun getAnnouncements(): Response<AnnouncementResponse>

    companion object {
        private const val BASE_URL = "http://72.61.141.118:3000/api/"

        fun create(): AnnouncementService {
            val client = OkHttpClient.Builder()
                .addInterceptor { chain ->
                    val request: Request = chain.request().newBuilder()
                        .header("Authorization", "cff2f609d3accf61df924590eac88bc2e5107eb3df47af97576f3ab6139e59bc")
                        .build()
                    chain.proceed(request)
                }
                .build()

            val retrofit = Retrofit.Builder()
                .baseUrl(BASE_URL)
                .client(client)
                .addConverterFactory(GsonConverterFactory.create())
                .build()

            return retrofit.create(AnnouncementService::class.java)
        }
    }
}
